import type pg from 'pg';

export function getTimeIntervals(timeRange?: string): {
  currentClause: string;
  prevClause: string;
  timeWindowName: string;
  currentFilter: string;
  prevFilter: string;
  intervalDays: number;
};

export function applyTableAlias(filter: string, alias: string): string;
export function getWindowCount(row: Record<string, unknown> | undefined, timeRange: string): number;
export function computeTrendPercent(current: number, prev: number): number;
export function trendDirection(percent: number): 'up' | 'down' | 'neutral';
export function computeRealTopFeatures(pool: pg.Pool, timeRange?: string): Promise<unknown[]>;
export function getHeatmapDayCount(timeRange?: string): number;
export function getUsersWhereClause(timeRange?: string): string;
export function mapUserRows(rows: Record<string, unknown>[]): unknown[];
export function buildMetricsResponse(args: Record<string, unknown>): Record<string, unknown>;
export function computeRealHeatmapData(pool: pg.Pool, timeRange?: string, dayCountOverride?: number): Promise<Record<string, unknown>>;
export function metricsSalesQuery(intervals: ReturnType<typeof getTimeIntervals>): string;
