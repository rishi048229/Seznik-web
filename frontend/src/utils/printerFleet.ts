export type PrinterFleetModel = 'TEJ' | 'DEV' | 'VEER' | 'JOSH'

export const PREFERRED_PRINTER_KEY = 'seznik.preferredPrinterModel'
export const CONNECTED_PRINTER_KEY = 'seznik.connectedPrinterModel'

export interface PrinterFleetInfo {
  id: PrinterFleetModel
  name: string
  tagline: string
  paper: string
  kind: string
  receiptWidth: '58mm' | '80mm'
  connectionType: 'bluetooth' | 'system_driver'
  labelPrinterMode: 'tspl' | 'escpos'
  labelWidth: number
  labelHeight: number
}

export const PRINTER_FLEET: PrinterFleetInfo[] = [
  {
    id: 'TEJ',
    name: 'TEJ',
    tagline: '2-in-1 thermal POS receipt & die-cut label printer',
    paper: '50mm / 2-inch',
    kind: 'Receipt + labels',
    receiptWidth: '58mm',
    connectionType: 'bluetooth',
    labelPrinterMode: 'tspl',
    labelWidth: 50,
    labelHeight: 30,
  },
  {
    id: 'DEV',
    name: 'DEV',
    tagline: '2-in-1 Bluetooth POS & label printer',
    paper: '58mm',
    kind: 'Receipt + labels',
    receiptWidth: '58mm',
    connectionType: 'bluetooth',
    labelPrinterMode: 'tspl',
    labelWidth: 50,
    labelHeight: 30,
  },
  {
    id: 'VEER',
    name: 'VEER',
    tagline: 'Portable 58mm thermal POS receipt printer',
    paper: '58mm',
    kind: 'Receipts',
    receiptWidth: '58mm',
    connectionType: 'bluetooth',
    labelPrinterMode: 'escpos',
    labelWidth: 50,
    labelHeight: 30,
  },
  {
    id: 'JOSH',
    name: 'JOSH',
    tagline: 'Dedicated barcode & QR label printer',
    paper: 'Labels',
    kind: 'Labels',
    receiptWidth: '58mm',
    connectionType: 'bluetooth',
    labelPrinterMode: 'tspl',
    labelWidth: 50,
    labelHeight: 30,
  },
]

const isFleetModel = (value: string | null): value is PrinterFleetModel =>
  value === 'TEJ' || value === 'DEV' || value === 'VEER' || value === 'JOSH'

export const getPreferredPrinterModel = (): PrinterFleetModel | null => {
  try {
    const stored = localStorage.getItem(PREFERRED_PRINTER_KEY)
    return isFleetModel(stored) ? stored : null
  } catch {
    return null
  }
}

export const getConnectedPrinterModel = (): PrinterFleetModel | null => {
  try {
    const stored = localStorage.getItem(CONNECTED_PRINTER_KEY)
    return isFleetModel(stored) ? stored : null
  } catch {
    return null
  }
}

export const setPreferredPrinterModel = (model: PrinterFleetModel) => {
  localStorage.setItem(PREFERRED_PRINTER_KEY, model)
}

export const setConnectedPrinterModel = (model: PrinterFleetModel | null) => {
  if (!model) {
    localStorage.removeItem(CONNECTED_PRINTER_KEY)
    return
  }
  localStorage.setItem(CONNECTED_PRINTER_KEY, model)
}

export const getFleetInfo = (model: PrinterFleetModel | null) =>
  PRINTER_FLEET.find(p => p.id === model) || null

export const fleetPatchForModel = (model: PrinterFleetModel) => {
  const info = getFleetInfo(model)!
  return {
    paperSize: info.receiptWidth,
    connectionType: info.connectionType,
    labelPrinterMode: info.labelPrinterMode,
    labelWidth: info.labelWidth,
    labelHeight: info.labelHeight,
  } as const
}
