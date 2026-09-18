import { useCallback, useEffect, useState } from 'react';
import ThermalPrinterService from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';

export interface LabelPrinterStatus {
  /** True when a label can actually be printed right now, by either transport. */
  isConnected: boolean;
  /** Which transport is live, for wording the UI. */
  kind: 'label' | 'thermal' | 'dual' | null;
  /** Display name of whichever printer is connected. */
  name: string | null;
  refresh: () => void;
}

/**
 * Whether *any* printer capable of a label is connected.
 *
 * There are two independent transports and they know nothing about each other:
 * the ESC/POS printer lives in usePrinterStore as `activeDevice`, while a
 * DothanTech/Josh label printer is held inside the LPAPI native module and never
 * touches that store. Screens that checked only `activeDevice` therefore reported
 * "not connected" while a label printer was connected and printing happily —
 * which is exactly what the products page barcode dialog was doing.
 */
export function useLabelPrinterStatus(pollWhileVisible = true): LabelPrinterStatus {
  const { activeDevice, connectionState } = usePrinterStore();
  const [joshConnected, setJoshConnected] = useState(false);
  const [joshName, setJoshName] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // Asks both non-ESC/POS vendors, not just Josh: a connected YX printer would
    // otherwise report "not connected" while happily printing — the exact bug this
    // hook was written to fix for Josh in the first place.
    ThermalPrinterService.getConnectedLabelPrinterKind()
      .then(async (kind) => {
        setJoshConnected(kind !== null);
        if (kind === null) {
          setJoshName(null);
          return;
        }
        try {
          let name: string | null = null;
          if (kind === 'yx') {
            const info = await ThermalPrinterService.yxGetPrinterInfo();
            name = info?.name || null;
          } else if (kind === 'td404') {
            const model = usePrinterStore.getState().connectedPrinterModel;
            name = model === 'tejas' ? 'SEZNIK TEJAS' : 'SEZNIK RUDRA';
          } else {
            const info = await ThermalPrinterService.joshGetPrinterInfo();
            name = info?.name || null;
          }
          setJoshName(name);
        } catch {
          setJoshName(null);
        }
      })
      .catch(() => setJoshConnected(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(refresh);
    if (!pollWhileVisible) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh, pollWhileVisible]);

  const thermalConnected = !!activeDevice && connectionState === 'connected';
  const connectedModel = usePrinterStore.getState().connectedPrinterModel;
  const isDual =
    connectedModel === 'dev' ||
    connectedModel === 'rudra' ||
    connectedModel === 'tejas' ||
    (activeDevice?.name || '').toUpperCase().includes('DEV') ||
    (activeDevice?.name || '').toUpperCase().includes('RUDRA') ||
    (activeDevice?.name || '').toUpperCase().includes('TEJAS') ||
    (activeDevice?.name || '').toUpperCase().includes('2IN1') ||
    activeDevice?.type === 'dual';

  return {
    isConnected: joshConnected || thermalConnected,
    kind: joshConnected ? (isDual ? 'dual' : 'label') : isDual ? 'dual' : thermalConnected ? 'thermal' : null,
    name: joshConnected ? joshName || 'Label printer' : thermalConnected ? activeDevice?.name || null : null,
    refresh,
  };
}
