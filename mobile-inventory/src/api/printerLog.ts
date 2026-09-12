import { fetchApi } from './client';

export interface LogPrinterPayload {
  printerName: string;
  deviceAddress?: string | null;
  platform?: string;
  connectionType?: string;
}

export const logPrinterConnection = async (payload: LogPrinterPayload): Promise<void> => {
  try {
    await fetchApi('/printer-logs', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        platform: payload.platform || 'mobile',
      }),
    });
  } catch (error) {
    // Non-blocking fire-and-forget
    console.debug('[PrinterLog] Failed to log printer connection:', error);
  }
};
