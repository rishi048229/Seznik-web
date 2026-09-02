import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Platform, PermissionsAndroid, Vibration } from 'react-native';
import { Tag, Bluetooth, PowerOff, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import JoshLabelPrinter, { isJoshPrinterSupported, JoshPrinterDevice } from '../../../modules/josh-label-printer';
import ThermalPrinterService from '@/services/PrinterService';
import { getStoredJoshPrinter } from '@/services/secureStore';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Connect/disconnect UI for DothanTech ("Josh") LPAPI label printers.
 *
 * These sit alongside the ESC/POS receipt printer rather than replacing it — a shop
 * can have a receipt printer and a dedicated label printer connected at once, and
 * PrinterService routes label jobs here automatically whenever one is connected.
 */
export function JoshPrinterCard() {
  const theme = useAppTheme();
  const supported = isJoshPrinterSupported();

  const [devices, setDevices] = useState<JoshPrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ address: string; name: string } | null>(null);

  const refreshConnection = useCallback(async () => {
    if (!JoshLabelPrinter) return;
    try {
      const isOn = await JoshLabelPrinter.isConnected();
      if (!isOn) {
        setConnected(null);
        return;
      }
      const info = await JoshLabelPrinter.getPrinterInfo();
      setConnected(info ? { address: info.address, name: info.name } : null);
    } catch {
      setConnected(null);
    }
  }, []);

  useEffect(() => {
    if (!supported || !JoshLabelPrinter) return;

    // Kicked off as promises rather than called straight from the effect body, so no
    // state update happens synchronously during the effect (which would cascade renders).
    // joshEnsureConnected silently re-links the printer saved from a previous session,
    // so a shop that connected once sees "ready" here without touching anything.
    Promise.resolve()
      .then(() => ThermalPrinterService.joshEnsureConnected())
      .catch(() => {})
      .then(refreshConnection);

    // Surface the saved printer even before any scan, so reconnecting after the
    // silent attempt failed (printer was off) is a single tap, not a discovery wait.
    getStoredJoshPrinter()
      .then((saved) => {
        if (saved) setDevices((prev) => mergeDevices(prev, [{ address: saved.address, name: saved.name }]));
      })
      .catch(() => {});

    // Load already-paired printers so a returning user can reconnect without scanning.
    JoshLabelPrinter.getPairedPrinters()
      .then((paired) => setDevices((prev) => mergeDevices(prev, paired)))
      .catch(() => {});

    const foundSub = JoshLabelPrinter.addListener('onPrinterFound', (device) => {
      setDevices((prev) => mergeDevices(prev, [device]));
    });
    const stateSub = JoshLabelPrinter.addListener('onPrinterStateChange', () => {
      refreshConnection();
    });

    return () => {
      foundSub.remove();
      stateSub.remove();
      JoshLabelPrinter?.stopDiscovery().catch(() => {});
    };
  }, [supported, refreshConnection]);

  const ensureBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    // BLUETOOTH_SCAN/CONNECT exist from Android 12 (API 31); older versions grant
    // Bluetooth at install time but still gate discovery behind location.
    const needed =
      Platform.Version >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    try {
      const result = await PermissionsAndroid.requestMultiple(needed as any);
      return Object.values(result).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      return false;
    }
  };

  const handleScan = async () => {
    if (!JoshLabelPrinter) return;
    const ok = await ensureBluetoothPermissions();
    if (!ok) {
      Alert.alert('Permission Needed', 'Allow Bluetooth access so the app can find your label printer.');
      return;
    }
    setIsScanning(true);
    try {
      await JoshLabelPrinter.startDiscovery();
      // LPAPI reports devices through onPrinterFound as they appear; stop after a
      // short window so the button does not spin forever.
      setTimeout(() => {
        JoshLabelPrinter?.stopDiscovery().catch(() => {});
        setIsScanning(false);
      }, 8000);
    } catch (e: any) {
      setIsScanning(false);
      Alert.alert('Scan Failed', e?.message || 'Could not search for label printers.');
    }
  };

  const handleConnect = async (device: JoshPrinterDevice) => {
    if (!JoshLabelPrinter) return;
    const ok = await ensureBluetoothPermissions();
    if (!ok) {
      Alert.alert('Permission Needed', 'Allow Bluetooth access to connect the label printer.');
      return;
    }
    setConnectingAddress(device.address);
    try {
      // Routed through PrinterService so the link is persisted — that's what lets
      // label prints silently reconnect after an app restart.
      const success = await ThermalPrinterService.joshConnect(device.address, device.name);
      if (success) {
        await refreshConnection();
        Alert.alert('Label Printer Linked', `${device.name} is ready. Label prints will now use it.`);
      } else {
        Alert.alert('Could Not Connect', `${device.name} did not accept the connection. Make sure it is switched on and in range.`);
      }
    } catch (e: any) {
      Alert.alert('Could Not Connect', e?.message || 'Connection failed.');
    } finally {
      setConnectingAddress(null);
    }
  };

  const handleDisconnect = async () => {
    if (!JoshLabelPrinter) return;
    try {
      await ThermalPrinterService.joshDisconnect();
      await refreshConnection();
      try { Vibration.vibrate(60); } catch (e) {}
    } catch (e: any) {
      // Ignored
    }
  };

  const [isTestPrinting, setIsTestPrinting] = useState(false);

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      const sample = {
        name: 'Sample Item 500g',
        sellingPrice: 250.0,
        barcode: '8901234567890',
        id: 'sample-1',
      };
      const ok = await ThermalPrinterService.printCustomLabel(sample, 'ean13', undefined, 50, 30, 3);
      if (ok) {
        Alert.alert('Test Label Sent! 🖨️', 'Printed test label via Josh Label Printer.');
      } else {
        Alert.alert('Print Error', 'Could not send test label.');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Failed to print test label.');
    } finally {
      setIsTestPrinting(false);
    }
  };

  // On iOS, or on a JS-only client that has not been rebuilt with the SDK, there is
  // nothing actionable to show — the ESC/POS label path stays in charge.
  if (!supported) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: connected ? '#10B981' : theme.borderColor }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: connected ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)' }]}>
          <Tag size={17} color={connected ? '#10B981' : '#64748B'} />
        </View>
        <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
            Label Printer (Josh)
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
            {connected ? `${connected.name} — ready` : 'Not connected'}
          </Text>
        </View>
        {connected ? <CheckCircle2 size={18} color="#10B981" /> : null}
      </View>

      <Text style={[styles.blurb, { color: theme.textSecondary }]}>
        A dedicated sticker/label printer. While it is connected, labels from Label Studio and the
        products page print here instead of on the receipt roll.
      </Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleScan}
          disabled={isScanning}
          style={[styles.primaryBtn, { backgroundColor: BRAND_COLORS.blue600, opacity: isScanning ? 0.6 : 1 }]}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Bluetooth size={14} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText} numberOfLines={1}>
                Scan
              </Text>
            </>
          )}
        </TouchableOpacity>

        {connected ? (
          <>
            <TouchableOpacity
              onPress={handleTestPrint}
              disabled={isTestPrinting}
              style={[styles.secondaryBtn, { borderColor: '#10B981', marginRight: 8 }]}
            >
              {isTestPrinting ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <>
                  <Tag size={14} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={[styles.secondaryBtnText, { color: '#10B981' }]} numberOfLines={1}>
                    Test Label
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDisconnect} style={[styles.secondaryBtn, { borderColor: '#EF4444' }]}>
              <PowerOff size={14} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={[styles.secondaryBtnText, { color: '#EF4444' }]} numberOfLines={1}>
                Disconnect
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={() => JoshLabelPrinter?.getPairedPrinters().then((p) => setDevices((prev) => mergeDevices(prev, p))).catch(() => {})}
            style={[styles.secondaryBtn, { borderColor: theme.borderColor }]}
          >
            <RefreshCw size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]} numberOfLines={1}>
              Paired
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {devices.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          {devices.map((device) => {
            const isThis = connected?.address === device.address;
            return (
              <TouchableOpacity
                key={device.address}
                onPress={() => (isThis ? handleDisconnect() : handleConnect(device))}
                disabled={connectingAddress === device.address}
                style={[styles.deviceRow, { borderColor: isThis ? '#10B981' : theme.borderColor }]}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.deviceName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {device.name}
                  </Text>
                  <Text style={[styles.deviceAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                    {device.address}
                  </Text>
                </View>
                {connectingAddress === device.address ? (
                  <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                ) : (
                  <Text style={{ fontSize: 11, fontWeight: '800', color: isThis ? '#10B981' : BRAND_COLORS.blue600 }}>
                    {isThis ? 'Connected' : 'Connect'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** Keeps one row per MAC, so a paired printer that is also discovered is not listed twice. */
function mergeDevices(existing: JoshPrinterDevice[], incoming: JoshPrinterDevice[]): JoshPrinterDevice[] {
  const byAddress = new Map(existing.map((d) => [d.address, d]));
  for (const device of incoming) {
    if (!device?.address) continue;
    byAddress.set(device.address, device);
  }
  return Array.from(byAddress.values());
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 11.5, marginTop: 2 },
  blurb: { fontSize: 11.5, lineHeight: 16, marginTop: 10, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, flexShrink: 1 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  secondaryBtnText: { fontWeight: '800', fontSize: 12, flexShrink: 1 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  deviceName: { fontSize: 12.5, fontWeight: '800' },
  deviceAddr: { fontSize: 10.5, marginTop: 2 },
});
