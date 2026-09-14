import { Request, Response } from 'express'
import prisma from '../config/db'
import { getTenantUserId } from '../utils/ownerUser'
import {
  extractFromText,
  extractPdfText,
  isExtractThin,
  mergeExtract,
  sanitizeExtract,
  type UtilityBillExtractResult,
} from '../utils/utilityBillExtract'

const BILL_TYPES = new Set(['ELECTRICITY', 'WATER', 'GAS', 'BROADBAND', 'UTILITY'])
const PAYMENT_MODES = new Set(['CASH', 'UPI', 'CARD'])

const startOfTodayIST = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${parts}T00:00:00+05:30`)
}

const decodePayload = (imageBase64: string, mimeType?: string) => {
  let cleanMimeType = mimeType || 'image/jpeg'
  let cleanBase64 = String(imageBase64 || '')
  if (cleanBase64.startsWith('data:')) {
    const match = cleanBase64.match(/^data:([^;]+);base64,(.*)$/s)
    if (match) {
      cleanMimeType = match[1] || cleanMimeType
      cleanBase64 = match[2]
    } else if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1]
    }
  }
  return {
    mimeType: cleanMimeType,
    base64: cleanBase64.replace(/\s/g, '').trim(),
  }
}

const geminiKeys = () => {
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || ''
  return raw
    .split(/[,;\n]/)
    .map(k => k.replace(/["'\r]/g, '').trim())
    .filter(k => k.length >= 10)
}

const EXTRACT_PROMPT = `You are a deterministic Indian utility-bill OCR reader for SEZNIK kiosks.
Extract ONLY fields that are clearly printed on the bill. If a field is missing, cropped, or ambiguous, return an empty string "" (or 0 for billAmount). NEVER guess, invent, or complete a partial value.

Return ONLY raw JSON (no markdown):
{
  "billType": "ELECTRICITY" | "WATER" | "GAS" | "BROADBAND" | "UTILITY" | "",
  "provider": "",
  "consumerNumber": "",
  "consumerName": "",
  "dueDate": "",
  "billDate": "",
  "unitsConsumed": "",
  "billAmount": 0
}

Rules:
- provider: board/company name as printed (UPPCL Urban, Tata Power, BSES Rajdhani, Adani Electricity, BESCOM, MSEDCL, Torrent Power, Delhi Jal Board, IGL, Airtel Fiber, etc.)
- consumerNumber: CA / Consumer ID / Account No / K-No / BP No / IVRS / Connection No only
- consumerName: title-case person/firm name. Strip Mr/Mrs/Shri. Do not include address lines.
- dueDate and billDate: format DD-MMM-YYYY (e.g. 14-SEP-2026) only if a real date is visible
- unitsConsumed: include unit if printed (e.g. "142 kWh")
- billAmount: numeric payable amount only (net payable / amount due). No commas. 0 if unknown.
- Zero hallucination: empty string / 0 is always better than a guessed value.`

const geminiExtract = async (base64: string, mimeType: string): Promise<Partial<UtilityBillExtractResult> | null> => {
  const keys = geminiKeys()
  if (!keys.length) return null

  const models = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-pro-latest']
  const parts = mimeType.includes('pdf') || mimeType.startsWith('image/')
    ? [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: EXTRACT_PROMPT }]
    : [{ text: `${EXTRACT_PROMPT}\n\nDOCUMENT:\n` }]

  for (const apiKey of keys) {
    for (const modelName of models) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 45000)
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0,
                maxOutputTokens: 1024,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
            signal: controller.signal,
          },
        )
        if (!response.ok) continue
        const data: any = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('\n') || ''
        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned)
        return sanitizeExtract(parsed)
      } catch {
        continue
      } finally {
        clearTimeout(timeout)
      }
    }
  }
  return null
}

export const extractUtilityBill = async (req: Request, res: Response) => {
  try {
    getTenantUserId(req)
    const { imageBase64, mimeType } = req.body || {}
    if (!imageBase64) {
      return res.status(400).json({ error: 'Upload a PDF or image of the utility bill.' })
    }

    const payload = decodePayload(imageBase64, mimeType)
    let regexResult: UtilityBillExtractResult = {
      billType: '',
      provider: '',
      consumerNumber: '',
      consumerName: '',
      dueDate: '',
      billDate: '',
      unitsConsumed: '',
      billAmount: 0,
    }

    if (payload.mimeType.includes('pdf')) {
      try {
        const buffer = Buffer.from(payload.base64, 'base64')
        regexResult = extractFromText(extractPdfText(buffer))
      } catch (err) {
        console.warn('Utility bill PDF stream parse failed:', (err as Error)?.message)
      }
    }

    const needsAi = isExtractThin(regexResult) || !payload.mimeType.includes('pdf')
    if (needsAi) {
      const ai = await geminiExtract(payload.base64, payload.mimeType || 'image/jpeg')
      if (ai) regexResult = mergeExtract(regexResult, ai)
    }

    res.json(regexResult)
  } catch (error) {
    console.error('extractUtilityBill:', error)
    res.status(500).json({ error: 'Failed to extract bill details. Please fill the fields manually.' })
  }
}

export const getUtilityBills = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req)
    const search = String(req.query.search || '').trim()
    const billType = String(req.query.billType || '').trim().toUpperCase()
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))

    const where: any = { userId }
    if (BILL_TYPES.has(billType)) where.billType = billType
    if (search) {
      where.OR = [
        { consumerNumber: { contains: search, mode: 'insensitive' } },
        { consumerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { provider: { contains: search, mode: 'insensitive' } },
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { kioskName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [bills, total] = await Promise.all([
      prisma.utilityBill.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.utilityBill.count({ where }),
    ])

    res.json({ bills, total, page, limit })
  } catch (error) {
    console.error('getUtilityBills:', error)
    res.status(500).json({ error: 'Failed to fetch utility bills' })
  }
}

export const getUtilityBillStats = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req)
    const todayStart = startOfTodayIST()

    const [allBills, todayBills] = await Promise.all([
      prisma.utilityBill.findMany({
        where: { userId },
        select: { billAmount: true, convenienceFee: true, totalAmount: true, provider: true, billType: true },
      }),
      prisma.utilityBill.findMany({
        where: { userId, createdAt: { gte: todayStart } },
        select: { totalAmount: true, convenienceFee: true },
      }),
    ])

    const providerMap = new Map<string, { provider: string; count: number; amount: number }>()
    const typeCounts: Record<string, number> = {}
    let totalCollected = 0
    let totalConvenienceFee = 0
    let totalBillAmount = 0

    for (const bill of allBills) {
      totalCollected += bill.totalAmount || 0
      totalConvenienceFee += bill.convenienceFee || 0
      totalBillAmount += bill.billAmount || 0
      const provider = bill.provider?.trim() || 'Unknown'
      const row = providerMap.get(provider) || { provider, count: 0, amount: 0 }
      row.count += 1
      row.amount += bill.totalAmount || 0
      providerMap.set(provider, row)
      typeCounts[bill.billType] = (typeCounts[bill.billType] || 0) + 1
    }

    res.json({
      totalBills: allBills.length,
      totalCollected,
      totalConvenienceFee,
      totalBillAmount,
      todayCount: todayBills.length,
      todayCollected: todayBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      todayFee: todayBills.reduce((sum, b) => sum + (b.convenienceFee || 0), 0),
      topProviders: [...providerMap.values()].sort((a, b) => b.count - a.count).slice(0, 8),
      typeCounts,
    })
  } catch (error) {
    console.error('getUtilityBillStats:', error)
    res.status(500).json({ error: 'Failed to fetch utility bill stats' })
  }
}

export const createUtilityBill = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req)
    const body = req.body || {}
    const billAmount = Number(body.billAmount) || 0
    const convenienceFee = Number(body.convenienceFee) || 0
    const totalAmount = Number(body.totalAmount)
    const billType = String(body.billType || 'UTILITY').toUpperCase()
    const paymentMode = String(body.paymentMode || 'CASH').toUpperCase()

    if (billAmount < 0 || convenienceFee < 0) {
      return res.status(400).json({ error: 'Amounts cannot be negative.' })
    }
    if (!BILL_TYPES.has(billType)) {
      return res.status(400).json({ error: 'Invalid bill type.' })
    }
    if (!PAYMENT_MODES.has(paymentMode)) {
      return res.status(400).json({ error: 'Payment mode must be CASH, UPI, or CARD.' })
    }

    const bill = await prisma.$transaction(async (tx) => {
      const start = startOfTodayIST()
      const count = await tx.utilityBill.count({ where: { userId, createdAt: { gte: start } } })
      const stamp = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
      }).format(start).replace(/-/g, '')
      const receiptNumber = `UB-${stamp}-${String(count + 1).padStart(4, '0')}`

      return tx.utilityBill.create({
        data: {
          userId,
          receiptNumber,
          kioskName: String(body.kioskName || '').trim(),
          billType,
          provider: String(body.provider || '').trim(),
          consumerNumber: String(body.consumerNumber || '').trim(),
          consumerName: String(body.consumerName || '').trim(),
          dueDate: body.dueDate ? String(body.dueDate).trim() : null,
          billDate: body.billDate ? String(body.billDate).trim() : null,
          unitsConsumed: body.unitsConsumed ? String(body.unitsConsumed).trim() : null,
          billAmount,
          convenienceFee,
          totalAmount: Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : billAmount + convenienceFee,
          status: 'SUCCESS (PAID)',
          paymentMode,
          customerPhone: body.customerPhone ? String(body.customerPhone).trim() : null,
          operatorName: body.operatorName ? String(body.operatorName).trim() : null,
        },
      })
    })

    res.status(201).json(bill)
  } catch (error) {
    console.error('createUtilityBill:', error)
    res.status(500).json({ error: 'Failed to save utility bill' })
  }
}

export const deleteUtilityBill = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req)
    const id = String(req.params.id || '')
    const existing = await prisma.utilityBill.findFirst({ where: { id, userId } })
    if (!existing) {
      return res.status(404).json({ error: 'Bill record not found' })
    }
    await prisma.utilityBill.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    console.error('deleteUtilityBill:', error)
    res.status(500).json({ error: 'Failed to delete utility bill' })
  }
}
