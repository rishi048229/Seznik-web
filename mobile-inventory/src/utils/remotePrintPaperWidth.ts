import { useMemo } from 'react';
import type { Settings } from '@/api/settings';
import { useSettings } from '@/hooks/useSettings';
import { usePrinterStore } from '@/store/usePrinterStore';

/** Paper width for remote print jobs — matches admin printer calibration / store settings. */
export function resolveRemotePrintPaperWidth(settings?: Settings | null): '58mm' | '80mm' {
  const cfg =
    settings?.printerConfig && typeof settings.printerConfig === 'object'
      ? (settings.printerConfig as Record<string, unknown>)
      : null;
  if (cfg?.paperWidth === '80mm' || cfg?.paperSize === '80mm') return '80mm';
  if (cfg?.paperWidth === '58mm' || cfg?.paperSize === '58mm') return '58mm';
  const fromDevice = usePrinterStore.getState().paperWidth;
  return fromDevice === '58mm' ? '58mm' : '80mm';
}

export function useRemotePrintPaperWidth(): '58mm' | '80mm' {
  const { settings } = useSettings();
  return useMemo(() => resolveRemotePrintPaperWidth(settings), [settings]);
}
