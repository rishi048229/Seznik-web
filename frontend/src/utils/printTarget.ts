import type { UserSettings } from '@/types/settings.types'

export type BlePrinterLike = {
  status: string
  connect: () => Promise<void>
  print: (bytes: Uint8Array) => Promise<void>
}

/** True when a Bluetooth printer is already linked for this session. */
export const bleIsConnected = (ble?: BlePrinterLike | null) => ble?.status === 'connected'

/**
 * Thermal / KOT / label jobs should go to the Bluetooth printer whenever it is
 * connected, or when the user chose Bluetooth as the printer destination.
 * Browser print is only for A4 invoices and for "system printer" mode.
 */
export const shouldPrintThermalOverBle = (
  settings?: UserSettings | null,
  ble?: BlePrinterLike | null,
) => bleIsConnected(ble) || settings?.printerConfig?.connectionType === 'bluetooth'
