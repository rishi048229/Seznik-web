export type DateRangePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function getDateRangeForPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  if (preset === 'all') return { start: null, end: null };
  if (preset === 'today') return { start: startOfDay(now), end: endOfDay(now) };
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: startOfDay(start), end: endOfDay(now) };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfDay(start), end: endOfDay(now) };
  }
  return { start: null, end: null };
}

export function parseDateTimeInput(dateStr: string, timeStr: string): Date | null {
  const datePart = dateStr.trim();
  if (!datePart) return null;
  const parts = datePart.split(/[-/]/).map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts[0] > 999 ? parts : [parts[2], parts[1], parts[0]];
  const timePart = (timeStr || '00:00').trim();
  const [hh, mm] = timePart.split(':').map((p) => parseInt(p, 10) || 0);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatTimeInputValue(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function saleInDateRange(createdAt: string, range: DateRange): boolean {
  if (!range.start && !range.end) return true;
  const ts = new Date(createdAt).getTime();
  if (range.start && ts < range.start.getTime()) return false;
  if (range.end && ts > range.end.getTime()) return false;
  return true;
}
