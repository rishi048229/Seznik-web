import { useEffect, useState, useCallback } from 'react'
import {
  subscribeBlePrinter,
  getBlePrinterState,
  requestAndConnectPrinter,
  tryReconnectKnownPrinter,
  disconnectPrinter,
  printEscPos,
  isBluetoothSupported,
} from '@/utils/blePrinter'

export const useBlePrinter = () => {
  const [state, setState] = useState(getBlePrinterState())

  useEffect(() => {
    const unsub = subscribeBlePrinter(setState)
    const syncState = () => setState(getBlePrinterState())
    window.addEventListener('focus', syncState)
    const interval = setInterval(syncState, 2000)
    return () => {
      unsub()
      window.removeEventListener('focus', syncState)
      clearInterval(interval)
    }
  }, [])

  // Silently try to reconnect to a previously-authorized printer on mount,
  // so the user doesn't have to re-pick it every time they load the app.
  useEffect(() => {
    tryReconnectKnownPrinter().then(() => setState(getBlePrinterState()))
  }, [])

  const connect = useCallback(async () => {
    await requestAndConnectPrinter()
  }, [])

  const disconnect = useCallback(() => {
    disconnectPrinter()
  }, [])

  const print = useCallback(async (bytes: Uint8Array) => {
    await printEscPos(bytes)
  }, [])

  return {
    status: state.status,
    deviceName: state.deviceName,
    isSupported: isBluetoothSupported(),
    connect,
    disconnect,
    print,
  }
}
