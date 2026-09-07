import { useCallback, useEffect, useState } from 'react';
import ThermalPrinterService from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';

export interface LabelPrinterStatus {
  /** True when a label can actually be printed right now, by either transport. */
  isConnected: boolean;
  /** Which transport is live, for wording the UI. */
  kind: 'label' | 'thermal' | null;
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
          const info =
            kind === 'yx'
              ? await ThermalPrinterService.yxGetPrinterInfo()
              : await ThermalPrinterService.joshGetPrinterInfo();
          setJoshName(info?.name || null);
        } catch {
          setJoshName(null);
        }
      })
      .catch(() => setJoshConnected(false));
  }, []);

  useEffect(() => {
    // Kicked off as a promise rather than called straight from the effect body, so
    // no state update happens synchronously during the effect (cascading render).
    Promise.resolve().then(refresh);
    if (!pollWhileVisible) return;
    // The native module reports state through its own events rather than the
    // store, so a light poll keeps a mounted dialog honest without wiring an
    // extra subscription into every screen that needs the answer.
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh, pollWhileVisible]);

  const thermalConnected = !!activeDevice && connectionState === 'connected';

  return {
    isConnected: joshConnected || thermalConnected,
    // A dedicated label printer wins the label: it is the better destination and
    // the one the user explicitly linked for this purpose.
    kind: joshConnected ? 'label' : thermalConnected ? 'thermal' : null,
    name: joshConnected ? joshName || 'Label printer' : thermalConnected ? activeDevice?.name || null : null,
    refresh,
  };
}
