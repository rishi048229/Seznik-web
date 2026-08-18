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

export const checkAiStatus = async (_req: Request, res: Response) => {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
  const apiKey = rawKey.replace(/["'\r\n]/g, '').trim();

  const isConfigured = Boolean(apiKey && apiKey.length >= 10);
  const maskedKey = isConfigured
    ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)} (length: ${apiKey.length})`
    : 'NOT_FOUND';

  res.json({
    status: isConfigured ? 'ready' : 'missing_api_key',
    geminiConfigured: isConfigured,
    keyMasked: maskedKey,
    modelsSupported: [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro'
    ],
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

    // Resolve GEMINI_API_KEY (supports multiple common environment variable names)
    const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    const apiKey = rawKey.replace(/["'\r\n]/g, '').trim();

    if (!apiKey || apiKey.length < 10) {
      console.error('GEMINI_API_KEY is missing or invalid in environment.');
      return res.status(400).json({
        error: 'GEMINI_API_KEY is missing in server backend/.env. Please add GEMINI_API_KEY=AIzaSy... to backend/.env and restart with pm2 restart all --update-env.'
      });
    }

    // Extract base64 portion if data URI scheme was sent (e.g. data:image/png;base64,...)
    const cleanBase64 = documentData.includes(',') ? documentData.split(',')[1] : documentData;

    const promptText = `You are SEZ AI, an expert inventory extraction assistant. Analyze the uploaded document (which may be an image, fast food or restaurant menu, purchase invoice, supplier bill, handwritten receipt, sticker label grid, catalog, price list, PDF, Excel sheet, or CSV).

YOUR TASK: Extract EVERY SINGLE product / item present anywhere in the document.

For each item, extract:
1. "name": The exact item or dish or product name (e.g. "Hot Dog", "French Fries", "Cheese Pizza", "Veg Burger", "BALESTER BRUSH", "BANGLES", "JATI"). Do NOT use prices like "$ 4.95" or "₹ 40.00" as the name!
2. "sellingPrice": Numeric selling price (e.g. 4.95, 2.50, 80, 750, 150, 25, 40, 350). Strip $, ₹, Rs, or currency symbols.
3. "costPrice": Numeric cost price. If not mentioned, set equal to sellingPrice.
4. "categoryName": Appropriate category (e.g. Fast Food, Pizza, Beverages, Groceries, Jewelry, Packaging, Cosmetics, General).
5. "barcode": The exact barcode number or alphanumeric code if visible. Set null if not visible.
6. "taxRate": Tax percentage (0, 5, 12, 18, 28). Default 0.
7. "currentStock": Stock quantity. Default 10.
8. "unit": Unit type (piece, plate, portion, box, kg, liter, pack, bottle). Default "piece".

OUTPUT REQUIREMENT:
Return ONLY a valid JSON object matching this structure:
{
  "products": [
    {
      "name": "Hot Dog",
      "sellingPrice": 2.50,
      "costPrice": 2.50,
      "categoryName": "Fast Food",
      "barcode": null,
      "taxRate": 0,
      "currentStock": 10,
      "unit": "piece"
    }
  ]
}
RULES:
1. Extract ALL items found in the image or document. Do NOT skip any products.
2. Output ONLY raw JSON without additional markdown formatting.`;

    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-2.0-flash-lite',
    ];

    const isSpreadsheetOrText = 
      mimeType.includes('csv') || 
      mimeType.includes('sheet') || 
      mimeType.includes('excel') || 
      mimeType.includes('plain') ||
      mimeType.includes('text');

    let textContent = '';
    if (isSpreadsheetOrText) {
      try {
        textContent = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      } catch (e) {
        textContent = cleanBase64;
      }
    }

    const parseProductsFromText = (rawText: string): any[] => {
      if (!rawText) return [];
      try {
        const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.products)) return parsed.products;
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.items)) return parsed.items;
        if (Array.isArray(parsed.data)) return parsed.data;
      } catch (e) {
        // Fallback: extract JSON array or object with regex
        const arrayMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          try {
            const arr = JSON.parse(arrayMatch[0]);
            if (Array.isArray(arr)) return arr;
          } catch (_) {}
        }
        const objMatch = rawText.match(/\{[\s\S]*"products"\s*:\s*(\[[\s\S]*?\])[\s\S]*\}/);
        if (objMatch && objMatch[1]) {
          try {
            const arr = JSON.parse(objMatch[1]);
            if (Array.isArray(arr)) return arr;
          } catch (_) {}
        }
      }
      return [];
    };

    const ai = new GoogleGenAI({ apiKey });

    const extractFromPromptPayload = async (contentsPayload: any[]): Promise<any[]> => {
      let lastErr = '';
      for (const modelName of modelsToTry) {
        // 1. Try SDK call
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
            config: {
              responseMimeType: 'application/json',
              maxOutputTokens: 65536,
            }
          });
          const text = response.text || '';
          const items = parseProductsFromText(text);
          if (items.length > 0) return items;
        } catch (err: any) {
          lastErr = err?.message || String(err);
          console.warn(`Gemini SDK model ${modelName} attempt:`, lastErr);
        }

        // 2. Try Direct REST API Fallback
        try {
          const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const partsPayload = isSpreadsheetOrText
            ? [{ text: `${promptText}\n\nDOCUMENT CONTENT:\n${textContent}` }]
            : [
                {
                  inline_data: {
                    mime_type: mimeType || 'image/jpeg',
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
                response_mime_type: 'application/json',
                maxOutputTokens: 65536,
              }
            })
          });

          if (restResponse.ok) {
            const restData: any = await restResponse.json();
            const text = restData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const items = parseProductsFromText(text);
            if (items.length > 0) return items;
          } else {
            const errText = await restResponse.text();
            console.warn(`Gemini REST model ${modelName} returned ${restResponse.status}:`, errText);
          }
        } catch (restErr: any) {
          console.warn(`Gemini REST model ${modelName} failed:`, restErr?.message || restErr);
        }
      }
      if (lastErr) console.error('Gemini extraction all models attempted. Last error:', lastErr);
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
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            promptText,
          ];

      rawList = await extractFromPromptPayload(contentsPayload);
    }

    if (rawList.length === 0) {
      return res.status(500).json({
        error: 'AI document analysis returned no items or failed. Please check file format or split document.'
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

