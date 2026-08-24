// Web Bluetooth connection manager for thermal receipt printers.
//
// Supports multiple printer models via profiles: each profile is a known
// BLE service/characteristic pair used by a printer family. On connect we
// auto-detect which profile the device actually exposes, so any printer
// matching one of the profiles below "just works" from the same UI.

interface PrinterProfile {
  /** Human-readable family name (shown for diagnostics only). */
  name: string
  service: string
  /** Preferred write characteristic within the service. */
  characteristic: string
}

const PRINTER_PROFILES: PrinterProfile[] = [
  // Seznik Veer AND the Caysn/AutoReplyPrint label printer — both vendor SDKs
  // bundle the same lvrenyang BLE IO library (nzio BLEPrinting/NZBleIO), so
  // they share this exact service/characteristic pair. Confirmed by extracting
  // the UUIDs from both Android SDKs, not guessed.
  {
    name: 'Seznik Veer / Caysn label printer (lvrenyang BLE)',
    service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  },
  // Common BLE-serial profiles used by most generic thermal printers:
  {
    name: 'Generic serial (FFE0)',
    service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    characteristic: '0000ffe1-0000-1000-8000-00805f9b34fb',
  },
  {
    name: 'Generic serial (FF00)',
    service: '0000ff00-0000-1000-8000-00805f9b34fb',
    characteristic: '0000ff02-0000-1000-8000-00805f9b34fb',
  },
  {
    name: 'ISSC / Microchip transparent UART',
    service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    characteristic: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  },
  {
    name: 'ESC/POS printer service (18F0)',
    service: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
  },
]

// Vendor SDKs write in 20-byte chunks (default BLE ATT MTU payload) and wait
// for each write to complete before sending the next one.
const CHUNK_SIZE = 20

export type BlePrinterStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'printing'

export interface BlePrinterState {
  status: BlePrinterStatus
  deviceName: string | null
  /** Which printer profile the connected device matched (diagnostics). */
  profileName: string | null
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

export function getBluetoothUnsupportedReason(): string {
  if (isBluetoothSupported()) return ''
  if (isIosDevice()) {
    return 'iOS limits Web Bluetooth in all browsers (Chrome/Safari). Use Android Chrome, Desktop Chrome, WebBLE browser, or use System Print.'
  }
  return 'Web Bluetooth is supported on Chrome, Edge, and Opera browsers.'
}

let device: BluetoothDevice | null = null
let characteristic: BluetoothRemoteGATTCharacteristic | null = null
let supportsWriteWithResponse = true
let supportsWriteWithoutResponse = false

let state: BlePrinterState = {
  status: isBluetoothSupported() ? 'disconnected' : 'unsupported',
  deviceName: null,
  profileName: null,
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

// Finds the first profile the device actually exposes and returns its write
// characteristic. Falls back to any writable characteristic in the matched
// service if the preferred one is missing (some clones remap it).
async function resolveWriteCharacteristic(
  server: BluetoothRemoteGATTServer
): Promise<{ char: BluetoothRemoteGATTCharacteristic; profile: PrinterProfile }> {
  for (const profile of PRINTER_PROFILES) {
    let service: BluetoothRemoteGATTService
    try {
      service = await server.getPrimaryService(profile.service)
    } catch {
      continue // device doesn't expose this profile's service
    }

    try {
      const char = await service.getCharacteristic(profile.characteristic)
      const props = (char as { properties?: { write?: boolean; writeWithoutResponse?: boolean } })?.properties
      if (props?.write || props?.writeWithoutResponse) {
        return { char: char as unknown as BluetoothRemoteGATTCharacteristic, profile }
      }
    } catch {
      // fall through to scanning the service's characteristics
    }

    try {
      const chars = await (service as unknown as { getCharacteristics: () => Promise<Array<{ properties?: { write?: boolean; writeWithoutResponse?: boolean } }>> }).getCharacteristics()
      const writable = chars.find(c => c.properties?.write) ?? chars.find(c => c.properties?.writeWithoutResponse)
      if (writable) return { char: writable as unknown as BluetoothRemoteGATTCharacteristic, profile }
    } catch {
      continue
    }
  }
  throw new Error('Connected device does not look like a supported printer')
}

async function connectToDevice(dev: BluetoothDevice): Promise<void> {
  setState({ status: 'connecting', deviceName: dev.name ?? 'Printer' })
  dev.addEventListener('gattserverdisconnected', handleGattDisconnected)

  const server = await dev.gatt?.connect()
  if (!server) throw new Error('Unable to open a GATT connection to the printer')

  const { char, profile } = await resolveWriteCharacteristic(server)

  device = dev
  characteristic = char
  const props = (char as unknown as { properties?: { write?: boolean; writeWithoutResponse?: boolean } })?.properties
  supportsWriteWithoutResponse = !!props?.writeWithoutResponse
  supportsWriteWithResponse = !!props?.write
  setState({ status: 'connected', deviceName: dev.name ?? 'Printer', profileName: profile.name })
}


// Must be called directly from a user gesture (button click) — the browser
// blocks navigator.bluetooth.requestDevice() otherwise.
export async function requestAndConnectPrinter(): Promise<void> {
  if (!isBluetoothSupported()) {
    throw new Error('This browser does not support Bluetooth printing. Use Chrome or Edge.')
  }
  const services = PRINTER_PROFILES.map(p => p.service)
  const dev = await navigator.bluetooth!.requestDevice({
    // A device advertising ANY known printer service shows up in the picker.
    filters: services.map(service => ({ services: [service] })),
    // All profile services must be listed so we may talk to whichever the
    // device exposes after connecting (advertised and actual can differ).
    optionalServices: services,
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
  setState({ status: 'disconnected', deviceName: null, profileName: null })
}

export async function printEscPos(bytes: Uint8Array): Promise<void> {
  if (!characteristic) throw new Error('Printer not connected')

  setState({ status: 'printing' })
  try {
    // Prefer writeWithoutResponse with short 3ms pacing — eliminates 30-50ms round-trip
    // GATT ACK latency stalls per 20 bytes and streams bitmap logos smoothly to thermal printers.
    const useFastStream = supportsWriteWithoutResponse
    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + CHUNK_SIZE)
      if (useFastStream) {
        await characteristic.writeValueWithoutResponse(chunk)
        await new Promise(resolve => setTimeout(resolve, 3))
      } else {
        await characteristic.writeValueWithResponse(chunk)
      }
    }
  } finally {
    setState({ status: characteristic ? 'connected' : 'disconnected' })
  }
}
