import * as FileSystem from 'expo-file-system/legacy';
import { Product } from '@/types/product';

const CACHE_FILE = `${FileSystem.documentDirectory}product-catalog-v1.json`;

interface CatalogCachePayload {
  userId: string;
  updatedAt: number;
  products: Product[];
}

export async function readCatalogCache(userId: string): Promise<Product[] | null> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_FILE);
    if (!info.exists) return null;

    const raw = await FileSystem.readAsStringAsync(CACHE_FILE);
    const parsed = JSON.parse(raw) as CatalogCachePayload;
    if (parsed.userId !== userId || !Array.isArray(parsed.products)) return null;
    return parsed.products;
  } catch {
    return null;
  }
}

export async function writeCatalogCache(userId: string, products: Product[]): Promise<void> {
  try {
    const payload: CatalogCachePayload = {
      userId,
      updatedAt: Date.now(),
      products,
    };
    await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(payload));
  } catch (err) {
    console.warn('[catalogCache] write failed:', err);
  }
}

export async function clearCatalogCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_FILE, { idempotent: true });
    }
  } catch {
    // ignore
  }
}
