// Web Bluetooth connection manager for the Seznik Veer thermal receipt printer.
//
// UUIDs below come from the printer vendor's Android SDK (PrinterLibs) —
// confirmed from the BLEPrinting class's static initializer, not guessed.
const SERVICE_UUID = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
const CHARACTERISTIC_UUID = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'

// The vendor SDK writes in 20-byte chunks (default BLE ATT MTU payload) and
// waits for each write to complete before sending the next one.
const CHUNK_SIZE = 20

export type BlePrinterStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'printing'

export interface BlePrinterState {
  status: BlePrinterStatus
  deviceName: string | null
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

let device: BluetoothDevice | null = null
let characteristic: BluetoothRemoteGATTCharacteristic | null = null

let state: BlePrinterState = {
  status: isBluetoothSupported() ? 'disconnected' : 'unsupported',
  deviceName: null,
}

type Listener = (state: BlePrinterState) => void
const listeners = new Set<Listener>()

function setState(patch: Partial<BlePrinterState>) {
  state = { ...state, ...patch }
  listeners.forEach(listener => listener(state))
}

export function getBlePrinterState(): BlePrinterState {
  return state
}

export function subscribeBlePrinter(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

function handleGattDisconnected() {
  characteristic = null
  setState({ status: 'disconnected' })
}

async function connectToDevice(dev: BluetoothDevice): Promise<void> {
  setState({ status: 'connecting', deviceName: dev.name ?? 'Printer' })
  dev.addEventListener('gattserverdisconnected', handleGattDisconnected)

  const server = await dev.gatt?.connect()
  if (!server) throw new Error('Unable to open a GATT connection to the printer')

  const service = await server.getPrimaryService(SERVICE_UUID)
  const char = await service.getCharacteristic(CHARACTERISTIC_UUID)

  device = dev
  characteristic = char
  setState({ status: 'connected', deviceName: dev.name ?? 'Printer' })
}

// Must be called directly from a user gesture (button click) — the browser
// blocks navigator.bluetooth.requestDevice() otherwise.
export async function requestAndConnectPrinter(): Promise<void> {
  if (!isBluetoothSupported()) {
    throw new Error('This browser does not support Bluetooth printing. Use Chrome or Edge.')
  }
  const dev = await navigator.bluetooth!.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
  })
  await connectToDevice(dev)
}

// Reconnects to a printer the user already granted permission for in a past
// session, without showing the device picker again. Not supported in every
// browser (requires the experimental persistent-permissions API), so this
// silently returns false rather than throwing when unavailable.
export async function tryReconnectKnownPrinter(): Promise<boolean> {
  if (!isBluetoothSupported() || !navigator.bluetooth!.getDevices) return false
  try {
    const known = await navigator.bluetooth!.getDevices!()
    if (known.length === 0) return false
    await connectToDevice(known[0])
    return true
  } catch {
    return false
  }
}

export function disconnectPrinter(): void {
  device?.gatt?.disconnect()
  device = null
  characteristic = null
  setState({ status: 'disconnected', deviceName: null })
}

export async function printEscPos(bytes: Uint8Array): Promise<void> {
  if (!characteristic) throw new Error('Printer not connected')

  setState({ status: 'printing' })
  try {
    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + CHUNK_SIZE)
      await characteristic.writeValueWithResponse(chunk)
    }
  } finally {
    setState({ status: characteristic ? 'connected' : 'disconnected' })
  }
}
