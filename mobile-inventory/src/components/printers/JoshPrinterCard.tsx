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
  Vibration,
  Image,
} from 'react-native';
import {
  Tag,
  Bluetooth,
  PowerOff,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react-native';
import JoshLabelPrinter, {
  isJoshPrinterSupported,
  JoshPrinterDevice,
} from '../../../modules/josh-label-printer';
import ThermalPrinterService from '@/services/PrinterService';
import { usePrinterStore } from '@/store/usePrinterStore';
import { getStoredJoshPrinter } from '@/services/secureStore';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useJoshDualModeTip } from '@/hooks/useJoshDualModeTip';
import { JoshDualModeModal } from '@/components/printers/JoshDualModeModal';
import { PrinterGlowCard } from '@/components/printers/PrinterGlowCard';

/**
 * Connect/disconnect UI for SEZNIK JOSH (LPAPI) label & receipt printers.
 */
export function JoshPrinterCard() {
  const theme = useAppTheme();
  const supported = isJoshPrinterSupported();
  const { shouldShowTip, markTipShown, dismissPermanently } = useJoshDualModeTip();

  const [devices, setDevices] = useState<JoshPrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ address: string; name: string } | null>(null);
  const [showTipModal, setShowTipModal] = useState(false);

  const pairedPrinters = usePrinterStore((s) => s.pairedPrinters);
  const scannedDevices = usePrinterStore((s) => s.scannedDevices);
  const scanForDevices = usePrinterStore((s) => s.scanForDevices);

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

  useEffect(() => {
    if (!supported || !JoshLabelPrinter) return;

    Promise.resolve()
      .then(() => ThermalPrinterService.joshEnsureConnected())
      .catch(() => {})
      .then(refreshConnection);

    // Seed saved printer
    getStoredJoshPrinter()
      .then((saved) => {
        if (saved) setDevices((prev) => mergeDevices(prev, [{ address: saved.address, name: saved.name }]));
      })
      .catch(() => {});

    // Seed paired & scanned Bluetooth devices from store
    const storeDevices = [...(pairedPrinters || []), ...(scannedDevices || [])];
    if (storeDevices.length > 0) {
      const initial = storeDevices.map((d) => ({ address: d.id, name: d.name }));
      setDevices((prev) => mergeDevices(prev, initial));
    }

    // Ensure permissions and load paired printers
    ensureBluetoothPermissions().then((ok) => {
      if (ok && JoshLabelPrinter) {
        JoshLabelPrinter.getPairedPrinters()
          .then((paired) => {
            if (paired && paired.length > 0) {
              setDevices((prev) => mergeDevices(prev, paired));
            }
          })
          .catch(() => {});
      }
    });

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
  }, [supported, refreshConnection, pairedPrinters, scannedDevices]);

  const handleScan = async () => {
    if (!JoshLabelPrinter) return;

    // 1. Immediately seed paired & scanned Bluetooth devices
    const storeDevices = [...(pairedPrinters || []), ...(scannedDevices || [])];
    if (storeDevices.length > 0) {
      const initial = storeDevices.map((d) => ({ address: d.id, name: d.name }));
      setDevices((prev) => mergeDevices(prev, initial));
    }

    if (scanForDevices) {
      scanForDevices().catch(() => {});
    }

    const ok = await ensureBluetoothPermissions();
    if (!ok) {
      Alert.alert('Permission Needed', 'Allow Bluetooth access so the app can find your label printer.');
      return;
    }
    setIsScanning(true);
    try {
      const paired = await JoshLabelPrinter.getPairedPrinters();
      if (paired && paired.length > 0) {
        setDevices((prev) => mergeDevices(prev, paired));
      }
      await JoshLabelPrinter.startDiscovery();
      setTimeout(() => {
        try {
          JoshLabelPrinter?.stopDiscovery().catch(() => {});
        } catch {}
        setIsScanning(false);
      }, 8000);
    } catch (e: any) {
      setIsScanning(false);
      console.log('[Josh] Scan error:', e);
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
      // Disconnect conflicting bridges
      usePrinterStore.getState().disconnectDevice().catch(() => {});
      if (ThermalPrinterService.isYxSupported()) {
        ThermalPrinterService.yxDisconnect().catch(() => {});
      }
      usePrinterStore.getState().setConnectedPrinterModel('josh');

      const success = await ThermalPrinterService.joshConnect(device.address, device.name);
      if (success) {
        await refreshConnection();
        try { Vibration.vibrate(50); } catch (e) {}
        if (shouldShowTip) {
          setShowTipModal(true);
        }
      } else {
        Alert.alert('Could Not Connect', 'Connection was refused. Ensure printer is on and in range.');
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
      usePrinterStore.getState().setConnectedPrinterModel(null as any);
      await refreshConnection();
      try { Vibration.vibrate(60); } catch (e) {}
      Alert.alert('Disconnected', 'SEZNIK JOSH has been disconnected.');
    } catch (e: any) {
      // Ignored
    }
  };

  const [isTestPrinting, setIsTestPrinting] = useState(false);

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
              if (ok) Alert.alert('Test Receipt Sent!', 'Printed sample receipt via SEZNIK JOSH.');
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
              if (ok) Alert.alert('Test Label Sent!', 'Printed test label via SEZNIK JOSH.');
              else Alert.alert('Print Error', 'Could not send test label.');
            } catch (e: any) {
              Alert.alert('Print Error', e?.message || 'Failed to print test label.');
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

  if (!supported) return null;

  return (
    <PrinterGlowCard active={!!connected} borderRadius={16}>
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: connected ? '#10B981' : theme.borderColor }]}>
      <View style={styles.headerRow}>
        <View style={styles.printerImageWrap}>
          <Image
            source={require('@/assets/images/printers/printer_josh.png')}
            style={styles.printerImage}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
              SEZNIK JOSH
            </Text>
            <View style={styles.dualBadge}>
              <Sparkles size={11} color="#6366F1" />
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
        SEZNIK JOSH 2-in-1 smart printer. Supports receipts and die-cut sticker labels.
      </Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleScan}
          disabled={isScanning}
          style={[styles.primaryBtn, { backgroundColor: '#6366F1', opacity: isScanning ? 0.6 : 1 }]}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Bluetooth size={14} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText} numberOfLines={1}>
                Scan JOSH
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

      {/* Discovered / Paired Devices list */}
      {devices.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Nearby SEZNIK JOSH Printers ({devices.length})
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
                <Tag size={16} color={isThis ? '#10B981' : theme.textSecondary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.deviceName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {d.name || 'SEZNIK JOSH'}
                  </Text>
                  <Text style={[styles.deviceAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                    {d.address}
                  </Text>
                </View>
                {isBusy ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : isThis ? (
                  <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>Active</Text>
                ) : (
                  <Text style={{ color: '#6366F1', fontSize: 11, fontWeight: '800' }}>Connect</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <JoshDualModeModal
        visible={showTipModal}
        onDismiss={() => {
          setShowTipModal(false);
          markTipShown();
        }}
        onDontShowAgain={() => {
          setShowTipModal(false);
          dismissPermanently();
        }}
      />
    </View>
    </PrinterGlowCard>
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
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dualBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 0.2,
  },
});
