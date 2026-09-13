import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';

const GEMINI_MODEL_FALLBACK_LIST = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
];

/**
 * Extracts plain text from raw PDF buffer without requiring native binary dependencies.
 * Parses uncompressed text streams, string literal tokens (Tj, TJ, '), and structural text chunks.
 */
function extractRawTextFromPdfBuffer(buffer: Buffer): string {
  try {
    const raw = buffer.toString('binary');
    const textPieces: string[] = [];

    // 1. Match Parenthesized text tokens inside text blocks: (Some Text) Tj or [(Some) (Text)] TJ
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(raw)) !== null) {
      if (match[1] && match[1].length > 0) {
        textPieces.push(match[1]);
      }
    }

    const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(raw)) !== null) {
      const inner = match[1];
      const innerMatches = inner.match(/\(([^)]+)\)/g);
      if (innerMatches) {
        textPieces.push(innerMatches.map((m) => m.slice(1, -1)).join(' '));
      }
    }

    // 2. Also extract readable ASCII sequences of 4+ characters as secondary fallback
    if (textPieces.length < 5) {
      const asciiMatches = raw.match(/[A-Za-z0-9\s:.,/₹\-=()]{4,}/g);
      if (asciiMatches) {
        textPieces.push(...asciiMatches.filter((s) => s.trim().length > 3));
      }
    }

    return textPieces.join('\n').replace(/\\([()\\])/g, '$1').trim();
  } catch (err) {
    console.warn('[PDF Text Extraction] Error extracting raw text from PDF buffer:', err);
    return '';
  }
}

/**
 * Known utility provider catalogs across India.
 */
const KNOWN_PROVIDERS = [
  // Uttar Pradesh
  { name: 'UPPCL (MVVNL / Madhyanchal)', regex: /(?:UPPCL|Madhyanchal|MVVNL)/i, type: 'ELECTRICITY' },
  { name: 'UPPCL (PVVNL / Pashchimanchal)', regex: /(?:Pashchimanchal|PVVNL)/i, type: 'ELECTRICITY' },
  { name: 'UPPCL (DVVNL / Dakshinanchal)', regex: /(?:Dakshinanchal|DVVNL)/i, type: 'ELECTRICITY' },
  { name: 'UPPCL (PuVVNL / Purvanchal)', regex: /(?:Purvanchal|PuVVNL)/i, type: 'ELECTRICITY' },
  { name: 'UPPCL (KESCO Kanpur)', regex: /KESCO/i, type: 'ELECTRICITY' },
  { name: 'UPPCL Urban / Rural', regex: /UPPCL/i, type: 'ELECTRICITY' },

  // Delhi NCR
  { name: 'BSES Rajdhani (BRPL)', regex: /(?:BSES\s*Rajdhani|BRPL)/i, type: 'ELECTRICITY' },
  { name: 'BSES Yamuna (BYPL)', regex: /(?:BSES\s*Yamuna|BYPL)/i, type: 'ELECTRICITY' },
  { name: 'Tata Power DDL', regex: /(?:Tata\s*Power|TPDDL)/i, type: 'ELECTRICITY' },
  { name: 'Delhi Jal Board (DJB)', regex: /(?:Delhi\s*Jal\s*Board|DJB)/i, type: 'WATER' },
  { name: 'Indraprastha Gas (IGL)', regex: /(?:Indraprastha\s*Gas|IGL)/i, type: 'GAS' },

  // Maharashtra
  { name: 'Adani Electricity Mumbai', regex: /(?:Adani\s*Electricity|Adani\s*Power)/i, type: 'ELECTRICITY' },
  { name: 'MSEDCL (Mahavitaran)', regex: /(?:MSEDCL|Mahavitaran|Mahadiscom)/i, type: 'ELECTRICITY' },
  { name: 'Tata Power Mumbai', regex: /Tata\s*Power/i, type: 'ELECTRICITY' },
  { name: 'BEST Undertaking Mumbai', regex: /BEST\s*(?:Undertaking|Electricity)/i, type: 'ELECTRICITY' },
  { name: 'Mahanagar Gas (MGL)', regex: /(?:Mahanagar\s*Gas|MGL)/i, type: 'GAS' },

  // Karnataka
  { name: 'BESCOM Bangalore', regex: /BESCOM/i, type: 'ELECTRICITY' },
  { name: 'MESCOM Mangalore', regex: /MESCOM/i, type: 'ELECTRICITY' },
  { name: 'HESCOM Hubli', regex: /HESCOM/i, type: 'ELECTRICITY' },
  { name: 'GESCOM Gulbarga', regex: /GESCOM/i, type: 'ELECTRICITY' },
  { name: 'BWSSB Bangalore Water', regex: /BWSSB/i, type: 'WATER' },

  // Gujarat
  { name: 'Torrent Power', regex: /Torrent\s*Power/i, type: 'ELECTRICITY' },
  { name: 'UGVCL Gujarat', regex: /UGVCL/i, type: 'ELECTRICITY' },
  { name: 'DGVCL Gujarat', regex: /DGVCL/i, type: 'ELECTRICITY' },
  { name: 'PGVCL Gujarat', regex: /PGVCL/i, type: 'ELECTRICITY' },
  { name: 'MGVCL Gujarat', regex: /MGVCL/i, type: 'ELECTRICITY' },
  { name: 'Gujarat Gas Ltd (GGL)', regex: /(?:Gujarat\s*Gas|GGL)/i, type: 'GAS' },

  // Tamil Nadu & AP / Telangana
  { name: 'TANGEDCO (TNEB)', regex: /(?:TANGEDCO|TNEB)/i, type: 'ELECTRICITY' },
  { name: 'TSSPDCL Telangana', regex: /TSSPDCL/i, type: 'ELECTRICITY' },
  { name: 'TSNPDCL Telangana', regex: /TSNPDCL/i, type: 'ELECTRICITY' },
  { name: 'APSPDCL Andhra', regex: /APSPDCL/i, type: 'ELECTRICITY' },
  { name: 'APEPDCL Andhra', regex: /APEPDCL/i, type: 'ELECTRICITY' },

  // West Bengal & Eastern India
  { name: 'WBSEDCL West Bengal', regex: /WBSEDCL/i, type: 'ELECTRICITY' },
  { name: 'CESC Kolkata', regex: /CESC/i, type: 'ELECTRICITY' },
  { name: 'SBPDCL South Bihar', regex: /SBPDCL/i, type: 'ELECTRICITY' },
  { name: 'NBPDCL North Bihar', regex: /NBPDCL/i, type: 'ELECTRICITY' },

  // Punjab, Haryana, Rajasthan & others
  { name: 'PSPCL Punjab', regex: /PSPCL/i, type: 'ELECTRICITY' },
  { name: 'DHBVN Haryana', regex: /DHBVN/i, type: 'ELECTRICITY' },
  { name: 'UHBVN Haryana', regex: /UHBVN/i, type: 'ELECTRICITY' },
  { name: 'JVVNL Jaipur', regex: /JVVNL/i, type: 'ELECTRICITY' },
  { name: 'AVVNL Ajmer', regex: /AVVNL/i, type: 'ELECTRICITY' },
  { name: 'JdVVNL Jodhpur', regex: /JdVVNL/i, type: 'ELECTRICITY' },
  { name: 'KSEB Kerala', regex: /KSEB/i, type: 'ELECTRICITY' },

  // Telecom & Broadband
  { name: 'Airtel Broadband / Xstream', regex: /Airtel/i, type: 'BROADBAND' },
  { name: 'Jio Fiber', regex: /(?:Jio\s*Fiber|Reliance\s*Jio)/i, type: 'BROADBAND' },
  { name: 'BSNL Bharat Fiber', regex: /BSNL/i, type: 'BROADBAND' },
  { name: 'ACT Fibernet', regex: /ACT\s*Fiber/i, type: 'BROADBAND' },
];

/**
 * Standardize dates into DD-MMM-YYYY (e.g. 15-Sep-2026).
 */
function standardizeDate(rawDateStr: string): string {
  if (!rawDateStr) return '';
  const cleaned = rawDateStr.replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. DD/MM/YYYY or DD-MM-YYYY
  const numMatch = cleaned.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1;
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;
    const dateObj = new Date(year, month, day);
    if (!isNaN(dateObj.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${String(day).padStart(2, '0')}-${monthNames[month] || 'Jan'}-${year}`;
    }
  }

  // 2. DD-MMM-YYYY or DD MMM YYYY (e.g. 15 Sep 2026 or 15-Sep-2026)
  const textMatch = cleaned.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})$/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthStr = textMatch[2].slice(0, 3).toLowerCase();
    let year = parseInt(textMatch[3], 10);
    if (year < 100) year += 2000;
    const monthMap: Record<string, string> = {
      jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
      jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec',
    };
    const formattedMonth = monthMap[monthStr] || textMatch[2].slice(0, 3);
    return `${String(day).padStart(2, '0')}-${formattedMonth}-${year}`;
  }

  // 3. Fallback date parse
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(parsed.getDate()).padStart(2, '0')}-${monthNames[parsed.getMonth()]}-${parsed.getFullYear()}`;
  }

  return rawDateStr;
}

/**
 * High-precision deterministic parser for Indian utility bills from text lines.
 */
export function parseUtilityBillFromRawText(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  let billType = 'ELECTRICITY';
  let provider = '';
  let consumerNumber = '';
  let consumerName = '';
  let dueDate = '';
  let billDate = '';
  let unitsConsumed = '';
  let billAmount = 0;
  let rawTextSnippet = '';

  // 1. Detect Provider & Bill Type
  for (const p of KNOWN_PROVIDERS) {
    if (p.regex.test(fullText)) {
      provider = p.name;
      billType = p.type;
      break;
    }
  }

  if (!provider) {
    if (/water|jal\s*board|sewerage/i.test(fullText)) {
      billType = 'WATER';
      provider = 'Municipal Water Board';
    } else if (/gas|png|cng|lpg/i.test(fullText)) {
      billType = 'GAS';
      provider = 'Piped Natural Gas (PNG)';
    } else if (/broadband|fiber|telecom|internet|telephone/i.test(fullText)) {
      billType = 'BROADBAND';
      provider = 'Broadband / Internet';
    } else {
      billType = 'ELECTRICITY';
      provider = 'Electricity Board';
    }
  }

  // 2. Detect Consumer Number / Account Number / CA Number
  const caPatterns = [
    /(?:CA\s*(?:Number|No|#)?|Consumer\s*(?:Number|No|ID|#)|Account\s*(?:Number|No|ID|#)|K\s*No|IVRS\s*(?:No|Number)?|BP\s*No|Connection\s*(?:No|Number|ID)|Service\s*(?:No|Number)|Customer\s*(?:No|ID)|CAN\s*No|RR\s*No)\s*[:.-]?\s*([A-Za-z0-9\/-]{5,22})/i,
    /(?:Account\s*ID|Consumer\s*Account\s*No|Connection\s*ID)\s*[:.-]?\s*([0-9]{8,16})/i,
    /\b(?:CA|K|BP)\s*No\.?\s*[:.-]?\s*([0-9]{8,14})\b/i,
  ];

  for (const pattern of caPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (!/^(date|name|amount|bill|units|month|phone)$/i.test(candidate)) {
        consumerNumber = candidate;
        break;
      }
    }
  }

  // 3. Detect Consumer Name
  const namePatterns = [
    /(?:Consumer\s*Name|Name\s*of\s*Consumer|Customer\s*Name|Subscriber\s*Name|Billing\s*Name|Bill\s*To)\s*[:.-]?\s*([A-Za-z\s.,'-]{3,40})/i,
    /(?:Shri|Smt\.?|Mr\.?|Mrs\.?|M\/s\.?)\s+([A-Za-z\s]{3,35})/i,
  ];

  for (const pattern of namePatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      let candidate = match[1].trim();
      // Remove trailing address keywords or prefixes
      candidate = candidate
        .replace(/\b(?:Address|S\/O|W\/O|D\/O|Father|Husband|Phone|Mobile|GSTIN|Meter|Subdivision|Division|Plot|Flat|Ward)\b.*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (candidate.length >= 3 && !/^(electric|water|bill|payment|total|sub|account|number)$/i.test(candidate)) {
        // Convert to Title Case
        consumerName = candidate
          .toLowerCase()
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        break;
      }
    }
  }

  // 4. Detect Due Date
  const dueDatePatterns = [
    /(?:Due\s*Date|Pay\s*By\s*Date|Payment\s*Due\s*Date|Last\s*Date\s*for\s*Payment|Before\s*Due\s*Date|Pay\s*By|Due\s*On)\s*[:.-]?\s*(\d{1,2}[-\/.][A-Za-z0-9]{1,4}[-\/.]\d{2,4})/i,
    /(?:Due\s*Date|Pay\s*By)\s*[:.-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
  ];

  for (const pattern of dueDatePatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      dueDate = standardizeDate(match[1].trim());
      break;
    }
  }

  // 5. Detect Bill Date / Issue Date
  const billDatePatterns = [
    /(?:Bill\s*Date|Issue\s*Date|Date\s*of\s*Bill|Invoice\s*Date|Billing\s*Date)\s*[:.-]?\s*(\d{1,2}[-\/.][A-Za-z0-9]{1,4}[-\/.]\d{2,4})/i,
    /(?:Bill\s*Date|Issue\s*Date)\s*[:.-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
  ];

  for (const pattern of billDatePatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      billDate = standardizeDate(match[1].trim());
      break;
    }
  }

  // 6. Detect Units Consumed (kWh)
  const unitPatterns = [
    /(?:Units?\s*(?:Consumed|Billed)?|Total\s*Consumption|Billed\s*Units?|Current\s*Units?|Units\s*\(KWh\))\s*[:.-]?\s*(\d+(?:\.\d+)?)\s*(?:kWh|Units?|KL)?/i,
    /(\d+(?:\.\d+)?)\s*(?:kWh|KWH|Units)\b/i,
  ];

  for (const pattern of unitPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      unitsConsumed = `${match[1].trim()} kWh`;
      break;
    }
  }

  // 7. Detect Bill Amount (Net Payable)
  const amountPatterns = [
    /(?:Net\s*Amount\s*Payable|Amount\s*Payable|Total\s*Amount\s*Due|Net\s*Payable|Total\s*Payable|Payable\s*Amount|Total\s*Due|Current\s*Bill\s*Amount|Bill\s*Amount|Current\s*Demand|Total\s*Bill)\s*[:.-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)\s*(?:Payable|Due|Total)/i,
    /(?:Gross\s*Amount|Total\s*Charges)\s*[:.-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const numStr = match[1].replace(/,/g, '').trim();
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0 && val < 500000) {
        billAmount = val;
        break;
      }
    }
  }

  // Meter Number or brief note snippet
  const meterMatch = fullText.match(/(?:Meter\s*(?:Number|No|#))\s*[:.-]?\s*([A-Za-z0-9\-]+)/i);
  if (meterMatch && meterMatch[1]) {
    rawTextSnippet = `Meter No: ${meterMatch[1].trim()}`;
  }

  return {
    billType,
    provider,
    consumerNumber,
    consumerName,
    dueDate,
    billDate,
    unitsConsumed,
    billAmount,
    rawTextSnippet,
  };
}

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
        setTimeout(() => reject(new Error(`Timeout with model ${modelName}`)), 35000)
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
 * Universal extraction endpoint for A4 electricity/utility bills.
 * Supports direct PDF stream text extraction & Indian utility bill heuristics,
 * with Gemini AI enhancement when available.
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

    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const isPdf = mimeType.toLowerCase().includes('pdf') || buffer.slice(0, 5).toString('ascii').startsWith('%PDF');

    let deterministicResult = {
      billType: 'ELECTRICITY',
      provider: '',
      consumerNumber: '',
      consumerName: '',
      dueDate: '',
      billDate: '',
      unitsConsumed: '',
      billAmount: 0,
      rawTextSnippet: '',
    };

    // 1. Direct PDF text stream extraction (instant & non-AI)
    if (isPdf) {
      const pdfText = extractRawTextFromPdfBuffer(buffer);
      if (pdfText && pdfText.length > 20) {
        deterministicResult = parseUtilityBillFromRawText(pdfText);
        // If PDF extraction found all essential fields, return immediately
        if (deterministicResult.consumerNumber && (deterministicResult.billAmount > 0 || deterministicResult.dueDate)) {
          return res.status(200).json({
            success: true,
            data: deterministicResult,
          });
        }
      }
    }

    // 2. Try Gemini AI if API key is present
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
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
1. If ANY field is not found or ambiguous, YOU MUST KEEP THAT FIELD EMPTY ("")!
2. DO NOT guess, fabricate, or hallucinate placeholder demo data.
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
                  mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
                },
              },
            ],
          },
        ];

        const jsonText = await generateWithGeminiFallback(ai, contents, { temperature: 0.1 });
        let parsed: any = {};
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          const cleaned = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleaned);
        }

        return res.status(200).json({
          success: true,
          data: {
            billType: String(parsed.billType || deterministicResult.billType || 'ELECTRICITY').trim().toUpperCase(),
            provider: String(parsed.provider || deterministicResult.provider || '').trim(),
            consumerNumber: String(parsed.consumerNumber || deterministicResult.consumerNumber || '').trim(),
            consumerName: String(parsed.consumerName || deterministicResult.consumerName || '').trim(),
            dueDate: standardizeDate(String(parsed.dueDate || deterministicResult.dueDate || '').trim()),
            billDate: standardizeDate(String(parsed.billDate || deterministicResult.billDate || '').trim()),
            unitsConsumed: String(parsed.unitsConsumed || deterministicResult.unitsConsumed || '').trim(),
            billAmount: Number(parsed.billAmount) || deterministicResult.billAmount || 0,
            rawTextSnippet: String(parsed.rawTextSnippet || deterministicResult.rawTextSnippet || '').trim(),
          },
        });
      } catch (aiErr) {
        console.warn('[extractUtilityBill] AI extraction failed, falling back to deterministic extraction:', aiErr);
      }
    }

    // 3. Fallback: Return deterministic parsed result
    return res.status(200).json({
      success: true,
      data: deterministicResult,
    });
  } catch (error: any) {
    console.error('Error in extractUtilityBill:', error);
    return res.status(200).json({
      success: true,
      data: {
        billType: 'ELECTRICITY',
        provider: '',
        consumerNumber: '',
        consumerName: '',
        dueDate: '',
        billDate: '',
        unitsConsumed: '',
        billAmount: 0,
        rawTextSnippet: '',
      },
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
        totalReceived: totalAmount,
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

    if (billType && String(billType).trim() && String(billType).trim().toUpperCase() !== 'ALL') {
      where.billType = {
        equals: String(billType).trim(),
        mode: 'insensitive',
      };
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

    let bills: any[] = [];
    let total = 0;

    try {
      [bills, total] = await Promise.all([
        (prisma as any).utilityBill.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        (prisma as any).utilityBill.count({ where }),
      ]);
    } catch (queryErr) {
      console.warn('[getUtilityBills] Query failed (e.g. initial table setup), returning empty list:', queryErr);
      bills = [];
      total = 0;
    }

    return res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    });
  } catch (error: any) {
    console.error('Error in getUtilityBills:', error);
    return res.status(200).json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
      },
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

    let allBills: any[] = [];
    let todayBills: any[] = [];

    try {
      [allBills, todayBills] = await Promise.all([
        (prisma as any).utilityBill.findMany({
          where: { userId },
          select: {
            billAmount: true,
            convenienceFee: true,
            totalAmount: true,
            totalReceived: true,
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
            totalReceived: true,
          },
        }),
      ]);
    } catch (queryErr) {
      console.warn('[getUtilityBillStats] Query failed (e.g. initial table setup), returning empty stats:', queryErr);
      allBills = [];
      todayBills = [];
    }

    const totalBills = allBills.length;
    let totalBillAmount = 0;
    let totalConvenienceFee = 0;
    let totalCollected = 0;

    const providerCounts: Record<string, { count: number; amount: number }> = {};
    const typeCounts: Record<string, number> = {};

    for (const b of allBills) {
      const bAmount = Number(b.billAmount) || 0;
      const bFee = Number(b.convenienceFee) || 0;
      const bTotal = Number(b.totalAmount || b.totalReceived) || (bAmount + bFee);

      totalBillAmount += bAmount;
      totalConvenienceFee += bFee;
      totalCollected += bTotal;

      const pKey = b.provider || 'Other';
      if (!providerCounts[pKey]) {
        providerCounts[pKey] = { count: 0, amount: 0 };
      }
      providerCounts[pKey].count += 1;
      providerCounts[pKey].amount += bTotal;

      const tKey = (b.billType || 'ELECTRICITY').toUpperCase();
      typeCounts[tKey] = (typeCounts[tKey] || 0) + 1;
    }

    const todayCount = todayBills.length;
    let todayCollected = 0;
    let todayFee = 0;
    for (const tb of todayBills) {
      const tbAmount = Number(tb.billAmount) || 0;
      const tbFee = Number(tb.convenienceFee) || 0;
      const tbTotal = Number(tb.totalAmount || tb.totalReceived) || (tbAmount + tbFee);
      todayCollected += tbTotal;
      todayFee += tbFee;
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
    return res.status(200).json({
      success: true,
      data: {
        totalBills: 0,
        totalCollected: 0,
        totalConvenienceFee: 0,
        totalBillAmount: 0,
        todayCount: 0,
        todayCollected: 0,
        todayFee: 0,
        topProviders: [],
        typeCounts: {},
      },
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
