import * as FileSystem from 'expo-file-system/legacy';
import { DashboardStats } from '@/types/dashboard';

const DASHBOARD_CACHE_FILE = `${FileSystem.documentDirectory}dashboard-stats-v1.json`;

interface DashboardCachePayload {
  userId: string;
  updatedAt: number;
  stats: DashboardStats;
}

export async function readDashboardCache(userId: string): Promise<DashboardStats | null> {
  try {
    const info = await FileSystem.getInfoAsync(DASHBOARD_CACHE_FILE);
    if (!info.exists) return null;

    const raw = await FileSystem.readAsStringAsync(DASHBOARD_CACHE_FILE);
    const parsed = JSON.parse(raw) as DashboardCachePayload;
    if (parsed.userId !== userId || !parsed.stats) return null;
    return parsed.stats;
  } catch {
    return null;
  }
}

export async function writeDashboardCache(userId: string, stats: DashboardStats): Promise<void> {
  try {
    const payload: DashboardCachePayload = {
      userId,
      updatedAt: Date.now(),
      stats,
    };
    await FileSystem.writeAsStringAsync(DASHBOARD_CACHE_FILE, JSON.stringify(payload));
  } catch (err) {
    console.warn('[dashboardCache] write failed:', err);
  }
}

export async function clearDashboardCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DASHBOARD_CACHE_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(DASHBOARD_CACHE_FILE, { idempotent: true });
    }
  } catch {
    // ignore
  }
}
