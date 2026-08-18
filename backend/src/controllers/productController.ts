import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../config/db';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const products = await prisma.product.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { imageUrl, sku, categoryId, ...rest } = req.body;

    // Map frontend `imageUrl` → Prisma column `imageURL`
    const imageURL = imageUrl ?? rest.imageURL ?? null;

    // Auto-generate SKU if not provided
    const finalSku = sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Ensure categoryId exists — use first user category as fallback
    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      const firstCat = await prisma.category.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (firstCat) {
        finalCategoryId = firstCat.id;
      } else {
        // Auto-create a "General" category for the user
        const newCat = await prisma.category.create({ data: { name: 'General', userId, isActive: true } });
        finalCategoryId = newCat.id;
      }
    }

    // Strip unknown fields that Prisma doesn't recognize
    delete rest.imageURL;
    delete rest.category;

    const product = await prisma.product.create({
      data: { ...rest, sku: finalSku, categoryId: finalCategoryId, imageURL, userId },
    });
    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { imageUrl, ...rest } = req.body;

    // Map frontend `imageUrl` → Prisma column `imageURL`
    if (imageUrl !== undefined) {
      rest.imageURL = imageUrl;
    }
    // Strip unknown fields
    delete rest.category;
    delete rest.id;
    delete rest.createdAt;
    delete rest.updatedAt;
    delete rest.userId;

    const product = await prisma.product.updateMany({
      where: { id: String(id), userId },
      data: rest,
    });
    res.json({ success: true, count: product.count });
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const softDeleteProduct = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    await prisma.product.updateMany({
      where: { id: String(id), userId },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const bulkSoftDeleteProducts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { productIds } = req.body; // array of ids
    
    await prisma.product.updateMany({
      where: { id: { in: productIds }, userId },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete products' });
  }
};

export const adjustStock = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    // Accept BOTH `qty` (legacy) and `change` (frontend) — `change` takes priority
    const { qty, change, reason } = req.body;
    const amount = change ?? qty;

    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return res.status(400).json({ error: 'Stock adjustment quantity is required (send `change` or `qty`)' });
    }

    const product = await prisma.product.findFirst({
      where: { id: String(id), userId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: String(id) },
        data: { currentStock: { increment: Number(amount) } },
      }),
      prisma.stockHistory.create({
        data: {
          change: Number(amount),
          reason: reason || 'manual-adjustment',
          productId: String(id),
          userId,
        },
      }),
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('adjustStock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};

export const getProductByBarcode = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { barcode } = req.params;
    
    const product = await prisma.product.findFirst({
      where: { barcode: String(barcode), userId, isActive: true },
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product by barcode' });
  }
};

export const batchBarcodeStockUpdate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { entries } = req.body; // array of { productId, qtyToAdd, barcode }

    await prisma.$transaction(
      entries.map((entry: any) => 
        prisma.product.update({
          where: { id: entry.productId, userId }, // Note: checking userId here is slightly tricky in transaction, but Prisma allows updateMany or standard update without userId if we assume it's secure. 
          data: { currentStock: { increment: entry.qtyToAdd } },
        })
      ).concat(
        entries.map((entry: any) =>
          prisma.stockHistory.create({
            data: {
              change: entry.qtyToAdd,
              reason: 'barcode-scan',
              barcode: entry.barcode,
              productId: entry.productId,
              userId,
            }
          })
        )
      )
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stock by barcode' });
  }
};

export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { threshold } = req.query;
    
    const products = await prisma.product.findMany({
      where: {
        userId,
        isActive: true,
        currentStock: { lte: Number(threshold) || 0 }
      },
      orderBy: { currentStock: 'asc' },
    });
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
};

/**
 * A Gemini model this API key can actually call right now, with the real
 * output-token ceiling Google reports for it.
 */
interface UsableModel {
  name: string;
  outputTokenLimit: number;
}

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const modelDiscoveryCache = new Map<string, { models: UsableModel[]; fetchedAt: number }>();

/**
 * Ranks models so we try the best general-purpose document-reading model first.
 *
 * Google's `-latest` aliases win outright: they track whatever the current GA
 * model is, so they keep working across model retirements without anyone
 * touching this file. Pinned versions follow as concrete fallbacks, newest
 * first, with previews well below GA and lite variants below full ones.
 */
const scoreModel = (name: string): number => {
  let score = 0;

  if (/-latest$/.test(name)) {
    score += 1000;
  } else {
    const version = name.match(/gemini-(\d+)(?:\.(\d+))?/);
    if (version) {
      score += Number(version[1]) * 100 + Number(version[2] ?? 0) * 10;
    }
  }

  if (name.includes('flash')) score += 50;
  else if (name.includes('pro')) score += 30;

  if (name.includes('lite')) score -= 60;                    // weakest at messy handwriting
  if (/preview|exp|experimental/.test(name)) score -= 200;   // never prefer preview over GA
  if (/thinking/.test(name)) score -= 10;
  if (/-\d{3,}$/.test(name)) score -= 5;                     // dated snapshot pins
  return score;
};

/**
 * Asks Google which models this key can use instead of hardcoding names.
 *
 * Hardcoded lists rot: Google retires models (the 1.5 family is gone for new
 * projects) and different keys/tiers see different catalogues, so a fixed list
 * eventually 404s for everyone. Discovering at runtime — and reading each
 * model's own outputTokenLimit rather than assuming one — keeps this working
 * as the catalogue changes underneath us. Cached for an hour per key.
 */
const discoverUsableModels = async (apiKey: string): Promise<UsableModel[]> => {
  const cached = modelDiscoveryCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < MODEL_CACHE_TTL_MS) {
    return cached.models;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
    );
    if (!res.ok) {
      console.warn(`Gemini ListModels failed (${res.status}):`, (await res.text()).slice(0, 300));
      return [];
    }

    const data: any = await res.json();
    const models: UsableModel[] = (data?.models ?? [])
      .filter((m: any) => Array.isArray(m?.supportedGenerationMethods)
        && m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => ({
        name: String(m.name || '').replace(/^models\//, ''),
        outputTokenLimit: Number(m.outputTokenLimit) || 8192,
      }))
      .filter((m: UsableModel) => m.name.startsWith('gemini-'))
      // Drop everything that isn't a general-purpose text/vision model.
      // The `-image` variants matter most here: they GENERATE images rather
      // than read them, so they rank deceptively well on name alone while
      // being completely wrong for OCR extraction.
      .filter((m: UsableModel) => !/embedding|aqa|imagen|veo|tts|audio|live|robotics|computer-use|-image$|-image-/i.test(m.name))
      .sort((a: UsableModel, b: UsableModel) => scoreModel(b.name) - scoreModel(a.name));

    if (models.length > 0) {
      modelDiscoveryCache.set(apiKey, { models, fetchedAt: Date.now() });
    }
    return models;
  } catch (err: any) {
    console.warn('Gemini ListModels request threw:', err?.message || err);
    return [];
  }
};

/**
 * Last-resort candidates if model discovery itself is unreachable.
 * Only evergreen aliases — a pinned version here would be the exact kind of
 * stale name that broke this feature in the first place.
 */
const FALLBACK_MODELS: UsableModel[] = [
  { name: 'gemini-flash-latest', outputTokenLimit: 65536 },
  { name: 'gemini-pro-latest', outputTokenLimit: 65536 },
];

export const checkAiStatus = async (_req: Request, res: Response) => {
  const rawKeyString = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
  const apiKeys = rawKeyString
    .split(/[,;\n]/)
    .map(k => k.replace(/["'\r]/g, '').trim())
    .filter(k => k.length >= 10);

  const isConfigured = apiKeys.length > 0;
  const maskedKey = isConfigured
    ? `${apiKeys[0].slice(0, 6)}...${apiKeys[0].slice(-4)} (length: ${apiKeys[0].length})`
    : 'NOT_FOUND';

  // Report what the key can really reach, so a bad key or a retired model
  // shows up here instead of only failing mid-upload.
  const available = isConfigured ? await discoverUsableModels(apiKeys[0]) : [];

  res.json({
    status: !isConfigured ? 'missing_api_key' : available.length > 0 ? 'ready' : 'no_models_available',
    geminiConfigured: isConfigured,
    keyCount: apiKeys.length,
    keyMasked: maskedKey,
    modelsAvailable: available.slice(0, 12).map(m => ({ model: m.name, maxOutputTokens: m.outputTokenLimit })),
    modelsWillTry: (available.length > 0 ? available : FALLBACK_MODELS).slice(0, 4).map(m => m.name),
    usingFallbackList: isConfigured && available.length === 0,
    timestamp: new Date().toISOString()
  });
};

export const aiExtractFromDocument = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const { documentData, mimeType = 'image/jpeg' } = req.body;

    if (!documentData) {
      return res.status(400).json({ error: 'No document data provided. Please upload an image, PDF, Excel, or CSV file.' });
    }

    // Resolve GEMINI_API_KEY (supports multiple comma-separated keys for auto-rotation on rate limits)
    const rawKeyString = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    const apiKeys = rawKeyString
      .split(/[,;\n]/)
      .map(k => k.replace(/["'\r]/g, '').trim())
      .filter(k => k.length >= 10);

    if (apiKeys.length === 0) {
      console.error('GEMINI_API_KEY is missing or invalid in environment.');
      return res.status(400).json({
        error: 'GEMINI_API_KEY is missing in server backend/.env. Please add GEMINI_API_KEY=AIzaSy... to backend/.env and restart PM2.'
      });
    }

    // Extract base64 portion if data URI scheme was sent (e.g. data:image/png;base64,...)
    let cleanMimeType = mimeType || 'image/jpeg';
    let cleanBase64 = documentData;

    if (documentData.startsWith('data:')) {
      const match = documentData.match(/^data:([^;]+);base64,(.*)$/s);
      if (match) {
        cleanMimeType = match[1] || cleanMimeType;
        cleanBase64 = match[2];
      } else if (documentData.includes(',')) {
        cleanBase64 = documentData.split(',')[1];
      }
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '').trim();

    const promptText = `You are SEZ AI, an expert inventory extraction assistant with strong OCR ability. Analyze the uploaded document and extract every product/item you can read.

The document may be any of these — treat each appropriately:
- A PHONE PHOTO of a paper bill, supplier invoice, or price list (may be angled, shadowed, blurry, or unevenly lit)
- A HANDWRITTEN bill, challan, or stock register page (cursive or print handwriting, possibly in English, Hindi, or a mix)
- A RESTAURANT / FAST-FOOD MENU (dish names with prices, often in columns or sections)
- A SCREENSHOT of a spreadsheet, billing software, WhatsApp message, or webpage
- A sticker/label grid sheet, product catalog page, PDF, spreadsheet, or CSV text

READING GUIDANCE FOR DIFFICULT IMAGES — this matters:
- Low light, glare, shadows, skew, and camera blur are EXPECTED. Read through them; do not give up.
- For handwriting, use surrounding context (column alignment, currency symbols, running totals) to resolve ambiguous characters.
- Common OCR confusions to resolve carefully: 0/O, 1/l/I, 5/S, 6/b, 8/B, 2/Z, 7/1.
- If a price is genuinely unreadable, still output the item with sellingPrice 0 rather than dropping it — the user reviews and corrects everything before import.
- NEVER return an empty product list just because quality is poor. Extract your best reading of whatever is legible.

For each item extract:
1. "name": The item/dish/product name exactly as written (e.g. "Hot Dog", "Cheese Pizza", "BALESTER BRUSH", "Parle-G 100g"). NEVER use a price like "$ 4.95" or "₹ 40.00" as the name.
2. "sellingPrice": Numeric selling price. Strip $, ₹, Rs, INR and commas (e.g. "₹ 1,250.00" -> 1250). If a row shows both MRP and a lower rate, prefer the selling/rate column.
3. "costPrice": Numeric cost/purchase price. If not shown, set equal to sellingPrice.
4. "categoryName": A sensible category (e.g. Fast Food, Beverages, Groceries, Jewelry, Stationery, Cosmetics, General). Infer from menu section headings or document context when present.
5. "barcode": The exact barcode/EAN/UPC/item-code if visible. Set null if not visible — do NOT invent one.
6. "taxRate": GST percentage (0, 5, 12, 18, 28). Default 0.
7. "currentStock": Quantity if shown. Default 10.
8. "unit": piece, plate, portion, box, kg, gram, liter, pack, bottle, dozen. Default "piece".

OUTPUT: Return ONLY a valid raw JSON object, no markdown fences, no commentary:
{
  "products": [
    { "name": "Hot Dog", "sellingPrice": 2.50, "costPrice": 2.50, "categoryName": "Fast Food", "barcode": null, "taxRate": 0, "currentStock": 10, "unit": "piece" }
  ]
}

RULES:
1. Extract ALL items anywhere in the document — every row, every menu section, every column. Do not skip or summarize.
2. Skip non-product lines: totals, subtotals, GST summary rows, discounts, "Grand Total", addresses, phone numbers, invoice numbers.
3. Output ONLY raw JSON.`;

    // Ask Google what this key can actually call, rather than trusting a
    // hardcoded list that goes stale every time a model is retired.
    const discovered = await discoverUsableModels(apiKeys[0]);
    const modelsToTry = (discovered.length > 0 ? discovered : FALLBACK_MODELS).slice(0, 4);
    console.log(
      `AI extraction will try: ${modelsToTry.map(m => m.name).join(', ')}` +
      (discovered.length === 0 ? ' (discovery unavailable — using fallback list)' : '')
    );

    const isSpreadsheetOrText = 
      cleanMimeType.includes('csv') || 
      cleanMimeType.includes('sheet') || 
      cleanMimeType.includes('excel') || 
      cleanMimeType.includes('plain') ||
      cleanMimeType.includes('text');

    let textContent = '';
    if (isSpreadsheetOrText) {
      try {
        textContent = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      } catch (e) {
        textContent = cleanBase64;
      }
    }

    // Helper: Recursively search ANY JSON structure (arrays, nested category objects, menu sections) for product items
    const extractItemsRecursively = (obj: any, parentKey = ''): any[] => {
      if (!obj) return [];
      if (Array.isArray(obj)) {
        let list: any[] = [];
        for (const item of obj) {
          if (item && typeof item === 'object') {
            const rawName = item.name || item.product_name || item.productName || item.itemName || item.item_name || item.dish || item.title || item.item || item.description || item.particulars || '';
            const rawPrice = item.sellingPrice ?? item.selling_price ?? item.price ?? item.rate ?? item.mrp ?? item.sale_price ?? item.amount ?? item.costPrice ?? item.cost;
            
            if (rawName || rawPrice !== undefined) {
              const nameStr = String(rawName || `Item ${list.length + 1}`).trim();
              const numPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || 0).replace(/[^0-9.]/g, '')) || 0;
              const rawCost = item.costPrice ?? item.cost_price ?? item.cost ?? numPrice;
              const numCost = typeof rawCost === 'number' ? rawCost : parseFloat(String(rawCost || 0).replace(/[^0-9.]/g, '')) || numPrice;
              const categoryStr = String(item.categoryName || item.category_name || item.category || (parentKey && !['products', 'items', 'data', 'menu', 'result', 'list'].includes(parentKey.toLowerCase()) ? parentKey : 'General')).trim();

              list.push({
                name: nameStr,
                sellingPrice: numPrice,
                costPrice: numCost,
                categoryName: categoryStr || 'General',
                barcode: item.barcode || item.bar_code || item.code || null,
                taxRate: Number(item.taxRate ?? item.tax_rate ?? item.tax ?? item.gst ?? 0) || 0,
                currentStock: Number(item.currentStock ?? item.current_stock ?? item.stock ?? item.quantity ?? item.qty ?? 10) || 10,
                unit: String(item.unit || item.uom || item.portion || 'piece').trim().toLowerCase()
              });
            } else {
              list = list.concat(extractItemsRecursively(item, parentKey));
            }
          }
        }
        return list;
      } else if (typeof obj === 'object') {
        let list: any[] = [];
        for (const key of Object.keys(obj)) {
          list = list.concat(extractItemsRecursively(obj[key], key));
        }
        return list;
      }
      return [];
    };

    const extractTextFromResponse = (response: any): string => {
      if (!response) return '';
      if (typeof response === 'string') return response;
      if (typeof response.text === 'function') {
        try {
          const res = response.text();
          if (res && typeof res === 'string') return res;
        } catch (_) {}
      }
      if (typeof response.text === 'string') return response.text;
      if (response.candidates?.[0]?.content?.parts) {
        return response.candidates[0].content.parts.map((p: any) => p.text || '').join('\n');
      }
      return '';
    };

    const parseProductsFromText = (rawText: string): any[] => {
      if (!rawText) return [];
      try {
        const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const extracted = extractItemsRecursively(parsed);
        if (extracted.length > 0) return extracted;
      } catch (e) {
        // Fallback: extract JSON array or object with regex
        const arrayMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          try {
            const arr = JSON.parse(arrayMatch[0]);
            const extracted = extractItemsRecursively(arr);
            if (extracted.length > 0) return extracted;
          } catch (_) {}
        }
        const objMatch = rawText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            const parsedObj = JSON.parse(objMatch[0]);
            const extracted = extractItemsRecursively(parsedObj);
            if (extracted.length > 0) return extracted;
          } catch (_) {}
        }
      }
      return [];
    };

    let hadRateLimit = false;
    let hadAuthError = false;
    // Every model+key attempt, so a failure report names the real blocker
    // instead of just whichever candidate happened to be tried last.
    const attemptErrors: { model: string; error: string }[] = [];
    const noteAttemptError = (model: string, error: string) => {
      attemptErrors.push({ model, error: String(error).slice(0, 200) });
    };

    const extractFromPromptPayload = async (contentsPayload: any[]): Promise<any[]> => {
      for (const apiKey of apiKeys) {
        const ai = new GoogleGenAI({ apiKey });

        for (const { name: modelName, outputTokenLimit: maxOutputTokens } of modelsToTry) {
          // 1. Try SDK call
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: contentsPayload,
              config: {
                responseMimeType: 'application/json',
                maxOutputTokens,
                // Deterministic reading — we want faithful OCR, not creative rewriting.
                temperature: 0,
              }
            });
            const text = extractTextFromResponse(response);
            const items = parseProductsFromText(text);
            if (items.length > 0) return items;
          } catch (err: any) {
            const msg = err?.message || String(err);
            noteAttemptError(`${modelName} (sdk)`, msg);
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('Rate limit')) {
              hadRateLimit = true;
            }
            if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API key not valid')) {
              hadAuthError = true;
            }
            console.warn(`Gemini SDK model ${modelName} attempt with key ${apiKey.slice(0, 6)}...:`, msg);
          }

          // 2. Try Direct REST API Fallback
          try {
            const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const partsPayload = isSpreadsheetOrText
              ? [{ text: `${promptText}\n\nDOCUMENT CONTENT:\n${textContent}` }]
              : [
                  {
                    inline_data: {
                      mime_type: cleanMimeType,
                      data: cleanBase64,
                    },
                  },
                  { text: promptText },
                ];

            const restResponse = await fetch(restUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: partsPayload }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  maxOutputTokens,
                  temperature: 0,
                }
              })
            });

            if (restResponse.ok) {
              const restData: any = await restResponse.json();
              const text = extractTextFromResponse(restData);
              const items = parseProductsFromText(text);
              if (items.length > 0) return items;
              // A 200 with no parsable items usually means the model hit its
              // output ceiling mid-JSON or genuinely saw no products.
              const finishReason = restData?.candidates?.[0]?.finishReason;
              if (finishReason && finishReason !== 'STOP') {
                noteAttemptError(
                  `${modelName} (rest)`,
                  `Model stopped early (${finishReason}) — the document may contain more items than one response can hold.`
                );
                console.warn(`Gemini REST model ${modelName} finishReason=${finishReason}`);
              }
            } else {
              const errText = await restResponse.text();
              noteAttemptError(`${modelName} (rest)`, errText);
              if (restResponse.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) {
                hadRateLimit = true;
              }
              if (restResponse.status === 403 || errText.includes('PERMISSION_DENIED')) {
                hadAuthError = true;
              }
              console.warn(`Gemini REST model ${modelName} returned ${restResponse.status}:`, errText);
            }
          } catch (restErr: any) {
            console.warn(`Gemini REST model ${modelName} failed:`, restErr?.message || restErr);
          }
        }
      }
      return [];
    };

    let rawList: any[] = [];

    // Optimization: If spreadsheet has more than 150 rows, process in parallel chunks!
    if (isSpreadsheetOrText && textContent) {
      const lines = textContent.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      if (lines.length > 150) {
        const header = lines[0];
        const dataLines = lines.slice(1);
        const chunkSize = 150;
        const chunks: string[] = [];

        for (let i = 0; i < dataLines.length; i += chunkSize) {
          const chunkLines = dataLines.slice(i, i + chunkSize);
          chunks.push([header, ...chunkLines].join('\n'));
        }

        console.log(`Processing ${lines.length} spreadsheet rows in ${chunks.length} parallel Gemini AI chunks...`);

        const chunkPromises = chunks.map(chunkText => 
          extractFromPromptPayload([`${promptText}\n\nSPREADSHEET CHUNK DATA TO EXTRACT:\n${chunkText}`])
        );

        const results = await Promise.all(chunkPromises);
        rawList = results.flat();
      }
    }

    // Fallback to single-call extraction if not chunked or image/PDF
    if (rawList.length === 0) {
      const contentsPayload = isSpreadsheetOrText
        ? [`${promptText}\n\nSPREADSHEET / TEXT DOCUMENT DATA TO EXTRACT:\n${textContent}`]
        : [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: cleanBase64,
              },
            },
            promptText,
          ];

      rawList = await extractFromPromptPayload(contentsPayload);
    }

    if (rawList.length === 0) {
      if (hadRateLimit) {
        return res.status(429).json({
          error: 'Google Gemini AI rate limit / quota exceeded (429). Please wait a few moments or add another API key to backend/.env (comma-separated).'
        });
      }
      if (hadAuthError) {
        return res.status(403).json({
          error: 'Invalid or restricted Google Gemini API key (403). Please verify your API key in backend/.env from https://aistudio.google.com/apikey'
        });
      }
      // Distinguish "the API call itself failed" from "the API worked but saw
      // no products". Previously both cases blamed image clarity/lighting,
      // which sent users chasing a photo problem that wasn't the real cause.
      if (attemptErrors.length > 0) {
        console.error('aiExtractFromDocument — every model attempt failed:', attemptErrors);

        // Prefer the most actionable failure over the chronologically last one:
        // a trailing 404 from a deprecated candidate hides the real blocker.
        const pick = (re: RegExp) => attemptErrors.find(a => re.test(a.error));
        const authErr = pick(/403|PERMISSION_DENIED|API key not valid|API_KEY_INVALID/i);
        const quotaErr = pick(/429|RESOURCE_EXHAUSTED|quota/i);
        const badReqErr = pick(/400|INVALID_ARGUMENT/i);
        const truncErr = pick(/stopped early/i);

        let hint: string;
        let chosen: { model: string; error: string };
        if (authErr) {
          hint = 'Your Gemini API key was rejected. Verify it at https://aistudio.google.com/apikey and confirm the Generative Language API is enabled for that project.';
          chosen = authErr;
        } else if (quotaErr) {
          hint = 'Gemini quota/rate limit reached. Wait a minute, or add a second key to GEMINI_API_KEY in backend/.env (comma-separated) to rotate automatically.';
          chosen = quotaErr;
        } else if (truncErr) {
          hint = 'The document has more items than one AI response can return. Split it into smaller files, or upload it as CSV/Excel.';
          chosen = truncErr;
        } else if (badReqErr) {
          hint = 'Gemini rejected the file payload — it may be an unsupported format or too large.';
          chosen = badReqErr;
        } else {
          hint = `No available Gemini model could process this file. Tried: ${modelsToTry.map(m => m.name).join(', ')}. Open /api/products/ai-status to see which models this key can actually use.`;
          chosen = attemptErrors[0];
        }

        return res.status(502).json({
          error: `${hint}\n\n(${chosen.model}: ${chosen.error.slice(0, 200)})`,
          triedModels: modelsToTry.map(m => m.name),
        });
      }

      return res.status(422).json({
        error: 'The AI read the file but could not identify any products in it. If this is a photo, try retaking it straighter and with more even lighting, or upload the price list as a CSV/Excel file instead.'
      });
    }
    
    // Fetch existing barcodes for this user to avoid duplicates
    const existingProducts = await prisma.product.findMany({
      where: { userId: rawUserId },
      select: { barcode: true }
    });
    const existingBarcodes = new Set(existingProducts.map(p => p.barcode).filter(Boolean));

    // Process extracted products
    const processedProducts = rawList.map((item, idx) => {
      let barcode = item.barcode ? String(item.barcode).trim() : '';
      let isExistingBarcode = false;

      if (barcode && barcode !== 'null' && barcode !== 'undefined') {
        isExistingBarcode = true;
      } else {
        // Auto-generate unique 12-digit barcode if no barcode existed in document
        do {
          const rand = Math.floor(1000000000 + Math.random() * 9000000000);
          barcode = `SZ${rand}`;
        } while (existingBarcodes.has(barcode));
      }

      existingBarcodes.add(barcode);

      return {
        id: `temp-${Date.now()}-${idx}`,
        name: String(item.name || `Extracted Item ${idx + 1}`).trim(),
        sellingPrice: Math.max(0, Number(item.sellingPrice) || 0),
        costPrice: Math.max(0, Number(item.costPrice) || 0),
        categoryName: String(item.categoryName || 'General').trim(),
        barcode,
        isExistingBarcode,
        barcodeType: 'CODE128',
        taxRate: Math.max(0, Number(item.taxRate) || 0),
        currentStock: Math.max(0, Number(item.currentStock) || 10),
        lowStockThreshold: 5,
        unit: String(item.unit || 'piece').toLowerCase().trim(),
        priceIncludesGst: false,
        selected: true
      };
    });

    res.json({
      success: true,
      count: processedProducts.length,
      products: processedProducts
    });
  } catch (error) {
    console.error('aiExtractFromDocument error:', error);
    res.status(500).json({ error: 'Failed to process document with Gemini AI' });
  }
};

export const bulkImportProducts = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const { products: items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided for bulk import.' });
    }

    // 1. Get or create categories
    const categoryNames = Array.from(new Set(items.map((i: any) => String(i.categoryName || 'General').trim())));
    const existingCategories = await prisma.category.findMany({
      where: { userId: rawUserId }
    });
    
    const categoryMap = new Map<string, string>();
    existingCategories.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id));

    for (const catName of categoryNames) {
      const lower = catName.toLowerCase();
      if (!categoryMap.has(lower)) {
        const newCat = await prisma.category.create({
          data: { name: catName, userId: rawUserId, isActive: true }
        });
        categoryMap.set(lower, newCat.id);
      }
    }

    // 2. Prepare product rows
    const createData = items.map((item: any, idx: number) => {
      const catId = categoryMap.get(String(item.categoryName || 'General').toLowerCase().trim())!;
      const sku = item.sku || `SKU-AI-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
      const barcode = item.barcode || `SZ${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      return {
        name: String(item.name).trim(),
        sku,
        barcode,
        barcodeType: item.barcodeType || 'CODE128',
        categoryId: catId,
        costPrice: Number(item.costPrice) || 0,
        sellingPrice: Number(item.sellingPrice) || 0,
        taxRate: Number(item.taxRate) || 0,
        priceIncludesGst: Boolean(item.priceIncludesGst),
        currentStock: Number(item.currentStock) || 0,
        lowStockThreshold: Number(item.lowStockThreshold) || 5,
        unit: String(item.unit || 'piece').toLowerCase().trim(),
        isActive: true,
        userId: rawUserId
      };
    });

    const result = await prisma.product.createMany({
      data: createData,
      skipDuplicates: true
    });

    res.json({
      success: true,
      count: result.count,
      products: createData
    });
  } catch (error) {
    console.error('bulkImportProducts error:', error);
    res.status(500).json({ error: 'Failed to bulk import products' });
  }
};

