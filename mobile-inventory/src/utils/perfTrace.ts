/**
 * Dev-only timing marks for the startup/POS-paint path. Stripped in production builds so the
 * measurement itself never costs anything on a cashier's device.
 *
 * Usage: `perfMark('catalog:hydrated')` for a point in time, or `perfSince('boot', ...)` to
 * report elapsed time from an earlier mark.
 */
export const APP_START = Date.now();

const enabled = __DEV__;

const marks = new Map<string, number>();

export function perfMark(label: string): void {
  if (!enabled) return;
  const now = Date.now();
  marks.set(label, now);
  console.log(`[perf] ${label} @ ${now - APP_START}ms since app start`);
}

export function perfSince(fromLabel: string, label: string): void {
  if (!enabled) return;
  const from = marks.get(fromLabel);
  if (from === undefined) {
    perfMark(label);
    return;
  }
  console.log(`[perf] ${label} +${Date.now() - from}ms after ${fromLabel}`);
}
