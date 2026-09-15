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
  Image,
} from 'react-native';
import {
  Tag,
  Bluetooth,
  PowerOff,
  CheckCircle2,
  Zap,
  Sparkles,
} from 'lucide-react-native';
import YxLabelPrinter, {
  isYxPrinterSupported,
  YxPrinterDevice,
} from '../../../modules/yx-label-printer';
import ThermalPrinterService from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { PrinterGlowCard } from '@/components/printers/PrinterGlowCard';

/**
 * Connect/disconnect UI for SEZNIK TEJ (TEJ Native SDK) smart label & receipt printers.
 */
export function YxPrinterCard() {
  const theme = useAppTheme();
  const supported = isYxPrinterSupported();

  const [devices, setDevices] = useState<YxPrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ address: string; name: string } | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isTestReceiptPrinting, setIsTestReceiptPrinting] = useState(false);

  const refreshConnection = useCallback(async () => {
    try {
      const isOn = await ThermalPrinterService.tejIsConnected();
      if (!isOn) {
        setConnected(null);
        return;
      }
      const info = await ThermalPrinterService.tejGetPrinterInfo();
      setConnected(info ? { address: info.address, name: info.name } : null);
    } catch {
      setConnected(null);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(refreshConnection);

    const storeDevices = [
      ...(usePrinterStore.getState().pairedPrinters || []),
      ...(usePrinterStore.getState().scannedDevices || []),
    ];
    setDevices((prev) =>
      mergeDevices(
        prev,
        storeDevices.map((d) => ({ address: d.id, name: d.name }))
      )
    );

    if (YxLabelPrinter) {
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
    }
  }, [refreshConnection]);

  const ensureBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
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
    if (!YxLabelPrinter) return;
    if (!(await ensureBluetoothPermissions())) {
      Alert.alert('Permission Needed', 'Allow Bluetooth access so the app can find your TEJ printer.');
      return;
    }
    setIsScanning(true);
    try {
      // Immediately refresh paired devices from SDK & system
      try {
        const paired = await YxLabelPrinter.getPairedPrinters();
        if (paired && paired.length > 0) {
          setDevices((prev) => mergeDevices(prev, paired));
        }
      } catch (e) {
        console.log('[TEJ Card] getPairedPrinters error:', e);
      }

      await YxLabelPrinter.startDiscovery();
      setTimeout(() => {
        YxLabelPrinter?.stopDiscovery().catch(() => {});
        setIsScanning(false);
      }, 8000);
    } catch (e: any) {
      setIsScanning(false);
      Alert.alert('Scan Failed', e?.message || 'Could not search for TEJ printers.');
    }
  };

  const handleConnect = async (device: YxPrinterDevice) => {
    if (!(await ensureBluetoothPermissions())) {
      Alert.alert('Permission Needed', 'Allow Bluetooth access to connect the TEJ printer.');
      return;
    }
    setConnectingAddress(device.address);
    try {
      // Disconnect conflicting bridges
      usePrinterStore.getState().disconnectDevice().catch(() => {});
      if (ThermalPrinterService.isJoshSupported()) {
        ThermalPrinterService.joshDisconnect().catch(() => {});
      }
      usePrinterStore.getState().setConnectedPrinterModel('tej');

      const ok = await ThermalPrinterService.tejConnect(device.address, device.name);
      if (ok) {
        const activePaperMode = usePrinterStore.getState().labelPaperMode || 'gap';
        ThermalPrinterService.yxCalibrate(activePaperMode === 'continuous' ? 0 : 2).catch(() => {});
      }
      await refreshConnection();
      if (ok) {
        Alert.alert('SEZNIK TEJ Linked', `${device.name} is ready for bills and labels.`);
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
      await ThermalPrinterService.tejDisconnect();
      usePrinterStore.getState().setConnectedPrinterModel(null as any);
      await refreshConnection();
      Alert.alert('Disconnected', 'SEZNIK TEJ has been disconnected.');
    } catch {
      // Ignored
    }
  };

  const handleTestPrint = () => {
    Alert.alert(
      'Test Print',
      'What would you like to print for testing?',
      [
        {
          text: 'Receipt',
          onPress: async () => {
            setIsTestPrinting(true);
            try {
              const ok = await ThermalPrinterService.printTestReceipt();
              if (ok) Alert.alert('Test Receipt Sent!', 'Printed sample receipt via SEZNIK TEJ.');
              else Alert.alert('Print Error', 'Could not send test receipt.');
            } catch (e: any) {
              Alert.alert('Print Error', e?.message || 'Failed to print test receipt.');
            } finally {
              setIsTestPrinting(false);
            }
          },
        },
        {
          text: 'Label',
          onPress: async () => {
            setIsTestPrinting(true);
            try {
              const sample = {
                name: 'Sample Item 500g',
                sellingPrice: 250.0,
                barcode: '8901234567890',
                id: 'sample-1',
              };
              const { labelWidthMm, labelHeightMm, labelGapMm } = usePrinterStore.getState();
              const ok = await ThermalPrinterService.printCustomLabel(
                sample,
                'ean13',
                undefined,
                labelWidthMm,
                labelHeightMm,
                labelGapMm
              );
              if (ok) Alert.alert('Test Label Sent!', 'Printed sample label on SEZNIK TEJ.');
              else Alert.alert('Print Error', 'Could not send the test label.');
            } catch (e: any) {
              Alert.alert('Print Error', e?.message || 'Failed to print the test label.');
            } finally {
              setIsTestPrinting(false);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
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

  if (!supported) return null;

  return (
    <PrinterGlowCard active={!!connected} borderRadius={16}>
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: connected ? '#10B981' : theme.borderColor }]}>
      <View style={styles.headerRow}>
        <View style={styles.printerImageWrap}>
          <Image
            source={require('@/assets/images/printers/printer_tej.png')}
            style={styles.printerImage}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
              SEZNIK TEJ
            </Text>
            <View style={styles.dualBadge}>
              <Sparkles size={11} color="#059669" />
              <Text style={styles.dualBadgeText}>Receipt + Label</Text>
            </View>
          </View>
          <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
            {connected ? `${connected.name} — ready` : 'Not connected'}
          </Text>
        </View>
        {connected ? <CheckCircle2 size={18} color="#10B981" /> : null}
      </View>

      <Text style={[styles.blurb, { color: theme.textSecondary }]}>
        SEZNIK TEJ high-speed smart printer. Supports receipts and die-cut sticker labels.
      </Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleScan}
          disabled={isScanning}
          style={[styles.primaryBtn, { backgroundColor: '#059669', opacity: isScanning ? 0.6 : 1 }]}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Bluetooth size={14} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText} numberOfLines={1}>
                Scan TEJ
              </Text>
            </>
          )}
        </TouchableOpacity>

        {connected ? (
          <>
            <TouchableOpacity
              onPress={handleTestPrint}
              disabled={isTestPrinting}
              style={[styles.secondaryBtn, { borderColor: '#10B981' }]}
            >
              {isTestPrinting ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Text style={[styles.secondaryBtnText, { color: '#10B981' }]} numberOfLines={1}>
                  Test Print
                </Text>
              )}
            </TouchableOpacity>

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
              onPress={handleDisconnect}
              style={[styles.secondaryBtn, { borderColor: '#EF4444' }]}
            >
              <PowerOff size={13} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={[styles.secondaryBtnText, { color: '#EF4444' }]} numberOfLines={1}>
                Disconnect
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* Discovered / Paired list */}
      {devices.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Nearby SEZNIK TEJ Printers ({devices.length})
          </Text>
          {devices.map((d) => {
            const isThis = connected?.address === d.address;
            const isBusy = connectingAddress === d.address;
            return (
              <TouchableOpacity
                key={d.address}
                onPress={() => handleConnect(d)}
                disabled={isThis || isBusy}
                style={[
                  styles.deviceRow,
                  {
                    backgroundColor: theme.bg,
                    borderColor: isThis ? '#10B981' : theme.borderColor,
                    opacity: isBusy ? 0.6 : 1,
                  },
                ]}
              >
                <Zap size={16} color={isThis ? '#10B981' : theme.textSecondary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.deviceName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {d.name || 'SEZNIK TEJ'}
                  </Text>
                  <Text style={[styles.deviceAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                    {d.address}
                  </Text>
                </View>
                {isBusy ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : isThis ? (
                  <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>Active</Text>
                ) : (
                  <Text style={{ color: '#059669', fontSize: 11, fontWeight: '800' }}>Connect</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
    </PrinterGlowCard>
  );
}

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
  printerImageWrap: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  printerImage: { width: 40, height: 40 },
  title: { fontSize: 15, fontWeight: '900' },
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
  dualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dualBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.2,
  },
});
