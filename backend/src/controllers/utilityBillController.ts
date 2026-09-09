import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';

const GEMINI_MODEL_FALLBACK_LIST = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

async function generateWithGeminiFallback(ai: GoogleGenAI, contents: any[], extraConfig: Record<string, any> = {}): Promise<string> {
  let lastErr: Error = new Error('No Gemini model attempted');
  for (const modelName of GEMINI_MODEL_FALLBACK_LIST) {
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents,
        config: { responseMimeType: 'application/json', ...extraConfig },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout with model ${modelName}`)), 16000)
      );
      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const text = response?.text || '';
      if (text) return text;
      lastErr = new Error(`Model ${modelName} returned an empty response`);
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err?.message || err));
      console.warn(`Gemini model ${modelName} failed in utility bill extraction:`, lastErr.message);
    }
  }
  throw lastErr;
}

/**
 * AI OCR extraction endpoint for A4 electricity/utility bills.
 * Strictly extracts only genuine fields present in the document.
 * If any field is missing or ambiguous, it is left empty ("").
 */
export const extractUtilityBill = async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'No image or document data provided for extraction',
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Gemini AI API key is not configured on the server',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const promptText = `
You are a high-precision OCR utility bill parser designed for converting A4 bills into thermal receipt slips.
Analyze this utility bill (electricity, water, gas, broadband, municipal tax, etc.) and extract the core details.

Return a strictly valid JSON object with these EXACT keys:
{
  "billType": string, // "ELECTRICITY", "WATER", "GAS", "BROADBAND", or "UTILITY"
  "provider": string, // Exact board/company name, e.g. "UPPCL Urban", "Tata Power", "BSES Yamuna", "Adani Electricity", "BWSSB", "Indraprastha Gas", etc. If NOT clearly visible, return ""
  "consumerNumber": string, // Account number, Consumer ID, CA number, K-number, or connection number. If NOT clearly visible, return ""
  "consumerName": string, // Name of the consumer/customer. If NOT clearly visible, return ""
  "dueDate": string, // Bill due date in DD-MMM-YYYY format (e.g. "15-Sep-2026"). If NOT found, return ""
  "billDate": string, // Bill issue date in DD-MMM-YYYY format. If NOT found, return ""
  "unitsConsumed": string, // Units or consumption amount with unit, e.g. "142 kWh" or "142". If NOT found, return ""
  "billAmount": number, // Total current bill payable amount as a float/number (e.g. 1450.00). If not found or zero, return 0
  "rawTextSnippet": string // Brief note or meter number if visible, otherwise ""
}

CRITICAL RULES:
1. If ANY field (dueDate, unitsConsumed, consumerName, consumerNumber, provider, billDate) is not found or ambiguous, YOU MUST KEEP THAT FIELD EMPTY ("")!
2. DO NOT guess, fabricate, hallucinate, or fill in placeholder demo data.
3. Clean the consumerName: remove designations like "(C)", mr/mrs prefixes if attached unnaturally, and format in clean Title Case.
4. For billAmount, return ONLY numeric digits with decimals (e.g. 1450 or 1450.00), no currency signs.
`;

    const contents = [
      {
        role: 'user',
        parts: [
          { text: promptText },
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType.toLowerCase().includes('pdf') ? 'application/pdf' : 'image/jpeg',
            },
          },
        ],
      },
    ];

    const jsonText = await generateWithGeminiFallback(ai, contents, { temperature: 0.1 });
    let parsed: any = {};
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      // Try cleaning markdown block if present
      const cleaned = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    return res.status(200).json({
      success: true,
      data: {
        billType: String(parsed.billType || 'ELECTRICITY').trim().toUpperCase(),
        provider: String(parsed.provider || '').trim(),
        consumerNumber: String(parsed.consumerNumber || '').trim(),
        consumerName: String(parsed.consumerName || '').trim(),
        dueDate: String(parsed.dueDate || '').trim(),
        billDate: String(parsed.billDate || '').trim(),
        unitsConsumed: String(parsed.unitsConsumed || '').trim(),
        billAmount: Number(parsed.billAmount) || 0,
        rawTextSnippet: String(parsed.rawTextSnippet || '').trim(),
      },
    });
  } catch (error: any) {
    console.error('Error in extractUtilityBill:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to extract utility bill details with AI',
    });
  }
};

/**
 * Save a newly generated utility bill kiosk record.
 */
export const createUtilityBill = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user?.id;
    if (!rawUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userId = await getOwnerUserId(rawUserId);

    const {
      billType = 'ELECTRICITY',
      provider = '',
      consumerNumber = '',
      consumerName = '',
      dueDate = '',
      billDate = '',
      unitsConsumed = '',
      billAmount = 0,
      convenienceFee = 0,
      status = 'SUCCESS',
      paymentMode = 'CASH',
      kioskName = 'SEZNIK KIOSK',
      operatorName,
      customerPhone,
      receiptNumber: incomingReceiptNumber,
    } = req.body;

    const parsedBillAmount = Math.max(0, Number(billAmount) || 0);
    const parsedFee = Math.max(0, Number(convenienceFee) || 0);
    const totalAmount = parsedBillAmount + parsedFee;

    // Generate readable receipt number if not supplied
    let receiptNumber = incomingReceiptNumber;
    if (!receiptNumber) {
      const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      receiptNumber = `UB-${datePart}-${randomSuffix}`;
    }

    const bill = await (prisma as any).utilityBill.create({
      data: {
        userId,
        receiptNumber,
        kioskName: kioskName || 'SEZNIK KIOSK',
        billType: String(billType || 'ELECTRICITY').trim().toUpperCase(),
        provider: String(provider || '').trim(),
        consumerNumber: String(consumerNumber || '').trim(),
        consumerName: String(consumerName || '').trim(),
        dueDate: dueDate ? String(dueDate).trim() : null,
        billDate: billDate ? String(billDate).trim() : null,
        unitsConsumed: unitsConsumed ? String(unitsConsumed).trim() : null,
        billAmount: parsedBillAmount,
        convenienceFee: parsedFee,
        totalAmount,
        status: status || 'SUCCESS',
        paymentMode: paymentMode || 'CASH',
        customerPhone: customerPhone ? String(customerPhone).trim() : null,
        operatorName: operatorName ? String(operatorName).trim() : null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Utility bill receipt saved successfully',
      data: bill,
    });
  } catch (error: any) {
    console.error('Error in createUtilityBill:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to save utility bill receipt',
    });
  }
};

/**
 * Fetch list of utility bills with filtering, search, and pagination.
 */
export const getUtilityBills = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user?.id;
    if (!rawUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userId = await getOwnerUserId(rawUserId);

    const {
      search = '',
      billType = '',
      page = '1',
      limit = '50',
      startDate,
      endDate,
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const take = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
    const skip = (pageNum - 1) * take;

    const where: any = { userId };

    if (billType && String(billType).trim()) {
      where.billType = String(billType).trim().toUpperCase();
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { receiptNumber: { contains: q, mode: 'insensitive' } },
        { consumerName: { contains: q, mode: 'insensitive' } },
        { consumerNumber: { contains: q, mode: 'insensitive' } },
        { provider: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [bills, total] = await Promise.all([
      (prisma as any).utilityBill.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      (prisma as any).utilityBill.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error('Error in getUtilityBills:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch utility bills',
    });
  }
};

/**
 * KPI stats and analytics for the A4 Kiosk Dashboard.
 */
export const getUtilityBillStats = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user?.id;
    if (!rawUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userId = await getOwnerUserId(rawUserId);

    // Today's boundaries in local server time
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [allBills, todayBills] = await Promise.all([
      (prisma as any).utilityBill.findMany({
        where: { userId },
        select: {
          billAmount: true,
          convenienceFee: true,
          totalAmount: true,
          provider: true,
          billType: true,
        },
      }),
      (prisma as any).utilityBill.findMany({
        where: {
          userId,
          createdAt: { gte: startOfToday },
        },
        select: {
          billAmount: true,
          convenienceFee: true,
          totalAmount: true,
        },
      }),
    ]);

    const totalBills = allBills.length;
    let totalBillAmount = 0;
    let totalConvenienceFee = 0;
    let totalCollected = 0;

    const providerCounts: Record<string, { count: number; amount: number }> = {};
    const typeCounts: Record<string, number> = {};

    for (const b of allBills) {
      totalBillAmount += b.billAmount;
      totalConvenienceFee += b.convenienceFee;
      totalCollected += b.totalAmount;

      const pKey = b.provider || 'Other';
      if (!providerCounts[pKey]) {
        providerCounts[pKey] = { count: 0, amount: 0 };
      }
      providerCounts[pKey].count += 1;
      providerCounts[pKey].amount += b.totalAmount;

      const tKey = b.billType || 'ELECTRICITY';
      typeCounts[tKey] = (typeCounts[tKey] || 0) + 1;
    }

    const todayCount = todayBills.length;
    let todayCollected = 0;
    let todayFee = 0;
    for (const tb of todayBills) {
      todayCollected += tb.totalAmount;
      todayFee += tb.convenienceFee;
    }

    // Top providers sorted by count
    const topProviders = Object.entries(providerCounts)
      .map(([provider, data]) => ({
        provider,
        count: data.count,
        amount: Math.round(data.amount * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return res.status(200).json({
      success: true,
      data: {
        totalBills,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalConvenienceFee: Math.round(totalConvenienceFee * 100) / 100,
        totalBillAmount: Math.round(totalBillAmount * 100) / 100,
        todayCount,
        todayCollected: Math.round(todayCollected * 100) / 100,
        todayFee: Math.round(todayFee * 100) / 100,
        topProviders,
        typeCounts,
      },
    });
  } catch (error: any) {
    console.error('Error in getUtilityBillStats:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch utility bill stats',
    });
  }
};

/**
 * Delete a utility bill record.
 */
export const deleteUtilityBill = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user?.id;
    if (!rawUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userId = await getOwnerUserId(rawUserId);
    const { id } = req.params;

    const existing = await (prisma as any).utilityBill.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Bill receipt not found' });
    }

    await (prisma as any).utilityBill.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'Utility bill receipt deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in deleteUtilityBill:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to delete utility bill',
    });
  }
};
