import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { Tag, Bluetooth, PowerOff, CheckCircle2 } from 'lucide-react-native';
import YxLabelPrinter, { isYxPrinterSupported, YxPrinterDevice } from '../../../modules/yx-label-printer';
import ThermalPrinterService from '@/services/PrinterService';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Connect/disconnect UI for YX-family label printers.
 *
 * A sibling of JoshPrinterCard rather than a merge into it: these are physically
 * different printers from different vendors, so the shop still has to choose which one
 * they are pairing. The unification the two share lives underneath — PrinterService
 * routes labels to whichever of them is connected, so Label Studio, the products
 * barcode dialog and POS never branch on vendor.
 *
 * Label-only by design: this SDK prints a rasterized bitmap and has no receipt mode,
 * unlike the dual-mode Josh unit, so no receipt test is offered here.
 */
export function YxPrinterCard() {
  const theme = useAppTheme();
  const supported = isYxPrinterSupported();

  const [devices, setDevices] = useState<YxPrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ address: string; name: string } | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  const refreshConnection = useCallback(async () => {
    if (!YxLabelPrinter) return;
    try {
      const isOn = await YxLabelPrinter.isConnected();
      if (!isOn) {
        setConnected(null);
        return;
      }
      const info = await YxLabelPrinter.getPrinterInfo();
      setConnected(info ? { address: info.address, name: info.name } : null);
    } catch {
      setConnected(null);
    }
  }, []);

  useEffect(() => {
    if (!supported || !YxLabelPrinter) return;

    // Kicked off as a promise rather than called straight from the effect body, so no
    // state update happens synchronously during the effect (which would cascade renders).
    Promise.resolve().then(refreshConnection);

    // Bonded printers come from the SDK's own lookup, so a returning user can reconnect
    // without waiting on a discovery sweep.
    YxLabelPrinter.getPairedPrinters()
      .then((paired) => setDevices((prev) => mergeDevices(prev, paired)))
      .catch(() => {});

    const foundSub = YxLabelPrinter.addListener('onPrinterFound', (device) => {
      setDevices((prev) => mergeDevices(prev, [device]));
    });
    const stateSub = YxLabelPrinter.addListener('onPrinterStateChange', () => {
      refreshConnection();
    });

    return () => {
      foundSub.remove();
      stateSub.remove();
      YxLabelPrinter?.stopDiscovery().catch(() => {});
    };
  }, [supported, refreshConnection]);

  const ensureBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    // BLUETOOTH_SCAN/CONNECT exist from Android 12 (API 31); older versions grant
    // Bluetooth at install time but still gate discovery behind location.
    const needed =
      Platform.Version >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    try {
      const result = await PermissionsAndroid.requestMultiple(needed as any);
      return Object.values(result).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      return false;
    }
  };

  const handleScan = async () => {
    if (!YxLabelPrinter) return;
    if (!(await ensureBluetoothPermissions())) {
      Alert.alert('Permission Needed', 'Allow Bluetooth access so the app can find your label printer.');
      return;
    }
    setIsScanning(true);
    try {
      await YxLabelPrinter.startDiscovery();
      // Devices arrive through onPrinterFound as they appear; stop after a short
      // window so the button does not spin forever.
      setTimeout(() => {
        YxLabelPrinter?.stopDiscovery().catch(() => {});
        setIsScanning(false);
      }, 8000);
    } catch (e: any) {
      setIsScanning(false);
      Alert.alert('Scan Failed', e?.message || 'Could not search for label printers.');
    }
  };

  const handleConnect = async (device: YxPrinterDevice) => {
    if (!YxLabelPrinter) return;
    if (!(await ensureBluetoothPermissions())) {
      Alert.alert('Permission Needed', 'Allow Bluetooth access to connect the label printer.');
      return;
    }
    setConnectingAddress(device.address);
    try {
      const ok = await ThermalPrinterService.yxConnect(device.address);
      await refreshConnection();
      if (ok) {
        Alert.alert('Label Printer Linked', `${device.name} is ready. Label prints will now use it.`);
      } else {
        Alert.alert(
          'Could Not Connect',
          `${device.name} did not accept the connection. Make sure it is switched on and in range.`
        );
      }
    } catch (e: any) {
      Alert.alert('Could Not Connect', e?.message || 'Connection failed.');
    } finally {
      setConnectingAddress(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await ThermalPrinterService.yxDisconnect();
      await refreshConnection();
    } catch {
      // Nothing actionable — the card re-reads state either way.
    }
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      const sample = { name: 'Sample Item 500g', sellingPrice: 250.0, barcode: '8901234567890', id: 'sample-1' };
      const ok = await ThermalPrinterService.printCustomLabel(sample, 'ean13', undefined, 50, 30, 3);
      if (ok) Alert.alert('Test Label Sent!', 'Printed a sample label on the YX printer.');
      else Alert.alert('Print Error', 'Could not send the test label.');
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Failed to print the test label.');
    } finally {
      setIsTestPrinting(false);
    }
  };

  const [isCalibrating, setIsCalibrating] = useState(false);

  const handleCalibrate = async () => {
    setIsCalibrating(true);
    try {
      const ok = await ThermalPrinterService.yxCalibrate();
      if (ok) {
        Alert.alert('Calibrated', 'Printer gap sensor calibrated and positioned successfully.');
      } else {
        Alert.alert('Calibration Sent', 'Calibration command sent to printer.');
      }
    } catch (e: any) {
      Alert.alert('Calibration Error', e?.message || 'Failed to calibrate.');
    } finally {
      setIsCalibrating(false);
    }
  };

  // On iOS, or on a JS-only client that has not been rebuilt with the SDK compiled in,
  // there is nothing actionable to show.
  if (!supported) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: connected ? '#10B981' : theme.borderColor }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: connected ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)' }]}>
          <Tag size={17} color={connected ? '#10B981' : '#64748B'} />
        </View>
        <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
            YX Label Printer
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
            {connected ? `${connected.name} — ready` : 'Not connected (labels only)'}
          </Text>
        </View>
        {connected ? <CheckCircle2 size={18} color="#10B981" /> : null}
      </View>

      <Text style={[styles.blurb, { color: theme.textSecondary }]}>
        Sticker label printer. While it is connected, labels from Label Studio and the products
        page print here — the same designs and sizes as any other label printer.
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
              onPress={handleCalibrate}
              disabled={isCalibrating}
              style={[styles.secondaryBtn, { borderColor: BRAND_COLORS.blue600 }]}
            >
              {isCalibrating ? (
                <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
              ) : (
                <Text style={[styles.secondaryBtnText, { color: BRAND_COLORS.blue600 }]} numberOfLines={1}>
                  Calibrate
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTestPrint}
              disabled={isTestPrinting}
              style={[styles.secondaryBtn, { borderColor: '#10B981' }]}
            >
              {isTestPrinting ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Text style={[styles.secondaryBtnText, { color: '#10B981' }]} numberOfLines={1}>
                  Test Label
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDisconnect} style={[styles.secondaryBtn, { borderColor: '#EF4444' }]}>
              <PowerOff size={14} color="#EF4444" />
            </TouchableOpacity>
          </>
        ) : null}
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

/** Keeps one row per MAC, so a bonded printer that is also discovered is not listed twice. */
function mergeDevices(existing: YxPrinterDevice[], incoming: YxPrinterDevice[]): YxPrinterDevice[] {
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
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, flexShrink: 1 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: { fontWeight: '800', fontSize: 12, flexShrink: 1 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  deviceName: { fontSize: 12.5, fontWeight: '800' },
  deviceAddr: { fontSize: 10.5, marginTop: 2 },
});
