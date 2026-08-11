import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

export const aiExtractFromDocument = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req as any).user.id;
    const { documentData, mimeType = 'image/jpeg' } = req.body;

    if (!documentData) {
      return res.status(400).json({ error: 'No document data provided. Please upload an image or PDF file.' });
    }

    // Strictly use backend server GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'AI document extraction service is currently unavailable. Please contact support.'
      });
    }

    // Extract base64 portion if data URI scheme was sent (e.g. data:image/png;base64,...)
    const cleanBase64 = documentData.includes(',') ? documentData.split(',')[1] : documentData;

    const promptText = `You are an expert AI inventory assistant. Analyze the uploaded document (supplier invoice, purchase bill, hotel/restaurant menu, price catalog, handwritten bill/receipt, or price list).
Extract ALL individual items/products with their details and return ONLY a valid JSON object matching this exact structure:
{
  "products": [
    {
      "name": "Item Name",
      "sellingPrice": 120,
      "costPrice": 80,
      "categoryName": "Beverages",
      "barcode": "8901234567890",
      "taxRate": 5,
      "currentStock": 50,
      "unit": "piece"
    }
  ]
}
RULES:
1. "barcode": If an existing barcode (numeric or alphanumeric) is visible in the document for the item, extract it EXACTLY. If NO barcode is printed or visible, set "barcode": null.
2. "categoryName": Infer an appropriate category name if not explicitly written (e.g. Starter, Main Course, Grocery, Snacks, Electronics).
3. "sellingPrice" and "costPrice": Extract prices as numeric values. If cost price is not mentioned, estimate or set equal to sellingPrice.
4. "unit": Infer appropriate unit (e.g. piece, kg, liter, plate, box, bottle, pack).
5. Output ONLY raw JSON. Do not include markdown code block formatting (no \`\`\`json).`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
    let rawContent = '';
    let lastError = '';

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          promptText,
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'image/jpeg',
            },
          },
        ]);
        rawContent = result.response.text() || '';
        if (rawContent) break;
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`Gemini SDK model ${modelName} failed:`, lastError);
      }
    }

    if (!rawContent) {
      console.error('All Gemini SDK models failed. Last error:', lastError);
      return res.status(500).json({ error: `Gemini AI service error: ${lastError || 'Unable to analyze document.'}` });
    }
    
    // Clean rawContent of any markdown fences
    const jsonStr = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let parsed: { products?: any[] } = {};
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse Gemini AI JSON output:', rawContent);
      return res.status(500).json({ error: 'AI analyzed the document but failed to produce a structured product list. Please try a clearer document image.' });
    }

    const rawList = Array.isArray(parsed.products) ? parsed.products : [];
    
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

    const result = await prisma.$transaction(
      createData.map(data => prisma.product.create({ data }))
    );

    res.json({
      success: true,
      count: result.length,
      products: result
    });
  } catch (error) {
    console.error('bulkImportProducts error:', error);
    res.status(500).json({ error: 'Failed to bulk import products' });
  }
};

