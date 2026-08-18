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
    const rawBarcode = String(req.params.barcode || '').trim();
    const cleanDigits = rawBarcode.replace(/[^0-9]/g, '');

    const product = await prisma.product.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [
          { barcode: rawBarcode },
          { sku: rawBarcode },
          { id: rawBarcode },
          ...(cleanDigits.length >= 4
            ? [
                { barcode: cleanDigits },
                { barcode: cleanDigits.replace(/^0+/, '') },
                { barcode: `0${cleanDigits}` },
                { sku: cleanDigits },
              ]
            : []),
        ],
      },
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

export const aiExtractFromDocument = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const rawData = req.body.documentData || req.body.imageBase64 || req.body.textData;
    const mimeType = req.body.mimeType || 'image/jpeg';

    if (!rawData) {
      return res.status(400).json({ error: 'No document data provided. Please upload an image, PDF, or document file.' });
    }

    // Trim and sanitize GEMINI_API_KEY from environment
    const rawKey = process.env.GEMINI_API_KEY || '';
    const apiKey = rawKey.replace(/["']/g, '').trim();

    if (!apiKey || apiKey.length < 10) {
      console.error('GEMINI_API_KEY is missing or invalid in environment.');
      return res.status(400).json({
        error: 'GEMINI_API_KEY is missing in server backend/.env. Please add GEMINI_API_KEY to backend/.env and restart server.'
      });
    }

    // Extract base64 portion if data URI scheme was sent (e.g. data:image/png;base64,...)
    const cleanBase64 = rawData.includes(',') ? rawData.split(',')[1] : rawData;

    const promptText = `You are SEZ AI, an expert inventory extraction assistant. Analyze the uploaded document (which may be an Excel sheet, HTML table, CSV data, PDF invoice, purchase bill, multi-column sticker label grid, hotel/restaurant menu, price catalog, handwritten bill, or price list).

YOUR TASK: Extract EVERY SINGLE product/item present anywhere in the document.

For each item, extract:
1. "name": The exact product name or description (e.g. "BALESTER BRUSH", "BANGLES", "JATI", "MOM CLAY BLACK", "TRAY BOMBAY"). Do NOT set currency prices like "₹ 40.00" as the product name!
2. "sellingPrice": Numeric selling price (e.g. 80, 750, 150, 25, 40, 350). Strip ₹, Rs, or currency symbols.
3. "costPrice": Numeric cost price. If not mentioned, set equal to sellingPrice.
4. "categoryName": Appropriate category (e.g. Groceries, Jewelry, Packaging, Cosmetics, General).
5. "barcode": CRITICAL BARCODE RULE:
   - Extract the EXACT barcode number or alphanumeric code (e.g. "165000", "365000", "135000", "105000", "OLDDUE8102023", "380000", "122800", "2608082035002", "2311041715357") printed or listed for the item. Do NOT change a single character!
   - Set "barcode": null ONLY if the item literally has NO barcode or code number anywhere.
6. "taxRate": Tax / GST percentage (0, 5, 12, 18, 28). Default to 0 if not listed.
7. "currentStock": Stock quantity. Default to 10 if not listed.
8. "unit": Unit type (piece, kg, liter, box, pack, bottle, plate).

OUTPUT REQUIREMENT:
Return ONLY a valid JSON object matching this exact structure:
{
  "products": [
    {
      "name": "Product Name",
      "sellingPrice": 100,
      "costPrice": 100,
      "categoryName": "General",
      "barcode": "165000",
      "taxRate": 0,
      "currentStock": 10,
      "unit": "piece"
    }
  ]
}
RULES:
1. Extract 100% of all items. Do NOT truncate or skip any products.
2. Output ONLY raw JSON without any markdown formatting.`;

    const ai = new GoogleGenAI({ apiKey });
    
    // Direct prioritized fast models without slow listing
    const modelsToTry = [
      'gemini-3.6-flash',
      'gemini-3.1-pro-preview',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
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

    const extractFromPromptPayload = async (contentsPayload: any[]): Promise<any[]> => {
      let lastErr = '';
      for (const modelName of modelsToTry) {
        try {
          const generatePromise = ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
            config: {
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
            }
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout with model ${modelName}`)), 35000)
          );

          const response: any = await Promise.race([generatePromise, timeoutPromise]);
          const text = response?.text || '';
          if (text) {
            const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            const list = Array.isArray(parsed.products) ? parsed.products : (Array.isArray(parsed) ? parsed : []);
            if (list.length > 0) return list;
          }
        } catch (err: any) {
          lastErr = err?.message || String(err);
          console.warn(`Gemini GenAI model ${modelName} failed:`, lastErr);
        }
      }
      if (lastErr) console.error('Gemini extraction error:', lastErr);
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
            promptText,
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
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
    const existingBarcodeSet = new Set(existingProducts.map(p => p.barcode).filter(Boolean));

    // Ensure strictly valid barcodes and SKUs
    const generateEAN13Barcode = () => {
      let b = '';
      do {
        b = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      } while (existingBarcodeSet.has(b));
      return b;
    };

    const sanitizedProducts = rawList.map((item: any, idx: number) => {
      let finalBarcode = item.barcode ? String(item.barcode).replace(/[^a-zA-Z0-9]/g, '').trim() : '';
      if (!finalBarcode || existingBarcodeSet.has(finalBarcode)) {
        finalBarcode = generateEAN13Barcode();
      }
      existingBarcodeSet.add(finalBarcode);

      const finalSku = item.sku ? String(item.sku).trim() : `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`;

      return {
        id: `temp-${Date.now()}-${idx}`,
        name: String(item.name || 'Extracted Product').trim(),
        sellingPrice: parseFloat(String(item.sellingPrice)) || 0,
        costPrice: parseFloat(String(item.costPrice || item.sellingPrice)) || 0,
        categoryName: String(item.categoryName || 'General').trim(),
        barcode: finalBarcode,
        sku: finalSku,
        barcodeType: 'CODE128',
        isExistingBarcode: !!item.barcode,
        taxRate: parseFloat(String(item.taxRate)) || 0,
        currentStock: parseInt(String(item.currentStock)) || 10,
        unit: String(item.unit || 'piece').trim(),
        lowStockThreshold: 5,
        priceIncludesGst: false,
        selected: true,
        userId: rawUserId
      };
    });

    res.json({
      success: true,
      count: sanitizedProducts.length,
      products: sanitizedProducts,
    });
  } catch (error) {
    console.error('aiExtractFromDocument error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error during AI extraction' });
  }
};

export const aiConvertInvoice = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const rawData = req.body.documentData || req.body.imageBase64 || req.body.textData;
    const mimeType = req.body.mimeType || 'image/jpeg';

    if (!rawData) {
      return res.status(400).json({ error: 'No invoice document data provided.' });
    }

    const rawKey = process.env.GEMINI_API_KEY || '';
    const apiKey = rawKey.replace(/["']/g, '').trim();

    if (!apiKey || apiKey.length < 10) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is missing in server backend/.env.' });
    }

    const cleanBase64 = rawData.includes(',') ? rawData.split(',')[1] : rawData;
    const ai = new GoogleGenAI({ apiKey });

    const promptText = `Analyze this purchase invoice, receipt, or bill image/PDF. Extract all invoice details into a JSON object:
{
  "invoiceNumber": "INV-1234",
  "date": "${new Date().toISOString().split('T')[0]}",
  "customerName": "Customer or Supplier Name",
  "items": [
    {
      "productName": "Product Name",
      "quantity": 2,
      "unitPrice": 100,
      "total": 200,
      "gstRate": 18
    }
  ],
  "subtotal": 200,
  "totalTax": 36,
  "grandTotal": 236
}
Return ONLY valid raw JSON with no markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        promptText,
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const saleData = JSON.parse(cleaned);

    res.json({
      success: true,
      saleData,
    });
  } catch (error) {
    console.error('aiConvertInvoice error:', error);
    res.status(500).json({ error: 'Failed to convert invoice with AI' });
  }
};

export const bulkImportProducts = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const items = Array.isArray(req.body.products)
      ? req.body.products
      : (Array.isArray(req.body.items)
        ? req.body.items
        : (Array.isArray(req.body) ? req.body : []));

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
      const barcode = item.barcode ? String(item.barcode).trim() : `SZ${Math.floor(1000000000 + Math.random() * 9000000000)}`;

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

    // Fetch the created/matched products from DB so the frontend gets full Product objects with actual database IDs
    const createdProducts = await prisma.product.findMany({
      where: {
        userId: rawUserId,
        barcode: { in: createData.map((p) => p.barcode).filter(Boolean) },
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      count: result.count || createdProducts.length,
      products: createdProducts.length > 0 ? createdProducts : createData
    });
  } catch (error) {
    console.error('bulkImportProducts error:', error);
    res.status(500).json({ error: 'Failed to bulk import products' });
  }
};


