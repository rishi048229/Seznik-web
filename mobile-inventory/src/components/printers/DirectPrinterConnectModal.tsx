import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Vibration,
  Platform,
  Alert,
} from 'react-native';
import {
  X,
  Printer,
  Bluetooth,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Share2,
} from 'lucide-react-native';
import { usePrinterStore, PhoneBluetoothDevice } from '@/store/usePrinterStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';

interface DirectPrinterConnectModalProps {
  visible: boolean;
  onClose: () => void;
  /** Optional callback fired automatically once a printer is successfully connected */
  onConnected?: () => void;
  title?: string;
  subtitle?: string;
  showContinueWithoutPrinter?: boolean;
  onContinueWithoutPrinter?: () => void;
}

export const DirectPrinterConnectModal: React.FC<DirectPrinterConnectModalProps> = ({
  visible,
  onClose,
  onConnected,
  title,
  subtitle,
  showContinueWithoutPrinter = true,
  onContinueWithoutPrinter,
}) => {
  const { t, currentLanguage } = useTranslation();
  const modalTitle = title || t('connectPrinter', 'Connect Thermal Printer');
  const modalSubtitle = subtitle || t('connectPrinterSub', 'No printer connected. Select or scan a Bluetooth receipt/label printer below to print.');
  const {
    connectionState,
    activeDevice,
    pairedPrinters,
    scannedDevices,
    isScanning,
    scanForDevices,
    connectDevice,
    warningText,
  } = usePrinterStore();

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const theme = useAppTheme();


  // Auto scan when modal opens if no paired printers or disconnected
  useEffect(() => {
    if (visible && connectionState !== 'connected') {
      scanForDevices().catch(() => {});
    }
  }, [visible]);

  const handleConnect = async (device: PhoneBluetoothDevice) => {
    setConnectingId(device.id);
    try {
      await connectDevice(device.id, device.name);
      Vibration.vibrate(100);
      if (onConnected) {
        onConnected();
      }
      onClose();
    } catch (e: any) {
      // Stay open on failure. Closing here (and firing onConnected) is what previously told the
      // caller a printer was ready when the socket had never opened.
      Alert.alert(
        t('connectionFailed', 'Connection Failed'),
        e?.message || t('connectionFailedSub', 'Could not reach the printer. Check that it is switched on and in range.'),
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          { text: t('retry', 'Retry'), onPress: () => handleConnect(device) },
        ]
      );
    } finally {
      setConnectingId(null);
    }
  };

  const handleScanAgain = () => {
    scanForDevices().catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                <Bluetooth size={20} color={BRAND_COLORS.blue600} />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>{modalTitle}</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>
                  {modalSubtitle}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.6}
            >
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Warning Banner if any */}
          {warningText ? (
            <View style={[styles.warningBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <AlertCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.warningText}>{warningText}</Text>
            </View>
          ) : null}

          {/* Device Lists Scroll */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={{ paddingVertical: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* PAIRED PRINTERS */}
            {pairedPrinters.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SAVED / PAIRED PRINTERS ({pairedPrinters.length})</Text>
                {pairedPrinters.map((p) => {
                  const isThisConnecting = connectingId === p.id;
                  const isThisActive = activeDevice?.id === p.id && connectionState === 'connected';

                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.8}
                      onPress={() => handleConnect(p)}
                      disabled={isThisConnecting || isThisActive}
                      style={[
                        styles.deviceItem,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: isThisActive ? '#10B981' : theme.borderColor,
                        },
                      ]}
                    >
                      <View style={[styles.deviceIconBox, { backgroundColor: isThisActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.1)' }]}>
                        <Printer size={18} color={isThisActive ? '#10B981' : BRAND_COLORS.blue600} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.deviceName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {p.name || 'Bluetooth Thermal Printer'}
                          </Text>
                          {p.isDefault ? (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.deviceMac, { color: theme.textSecondary }]}>
                          {p.macAddress || p.id} • {p.statusTag || 'Paired'}
                        </Text>
                      </View>

                      {isThisConnecting ? (
                        <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                      ) : isThisActive ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <CheckCircle2 size={16} color="#10B981" />
                          <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800', marginLeft: 4 }}>Ready</Text>
                        </View>
                      ) : (
                        <View style={styles.connectBtnSmall}>
                          <Text style={styles.connectBtnSmallText}>Connect</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {/* NEARBY DISCOVERED PRINTERS */}
            <View style={[styles.section, { marginTop: pairedPrinters.length > 0 ? 10 : 0 }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>NEARBY BLUETOOTH DEVICES ({scannedDevices.length})</Text>
                <TouchableOpacity onPress={handleScanAgain} disabled={isScanning} style={styles.scanRefreshBtn}>
                  <RefreshCw size={12} color={BRAND_COLORS.blue600} style={isScanning ? { transform: [{ rotate: '45deg' }] } : {}} />
                  <Text style={styles.scanRefreshText}>{isScanning ? 'Scanning...' : 'Scan Again'}</Text>
                </TouchableOpacity>
              </View>

              {isScanning && scannedDevices.length === 0 ? (
                <View style={styles.scanningPlaceholder}>
                  <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                  <Text style={[styles.scanningPlaceholderText, { color: theme.textSecondary }]}>
                    Searching for nearby Bluetooth printers...
                  </Text>
                </View>
              ) : scannedDevices.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: theme.borderColor }]}>
                  <Smartphone size={22} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No other Bluetooth devices found nearby. Ensure your printer is turned ON with Bluetooth enabled.
                  </Text>
                </View>
              ) : (
                scannedDevices.map((d) => {
                  const isThisConnecting = connectingId === d.id;
                  const isThisActive = activeDevice?.id === d.id && connectionState === 'connected';

                  return (
                    <TouchableOpacity
                      key={d.id}
                      activeOpacity={0.8}
                      onPress={() => handleConnect(d)}
                      disabled={isThisConnecting || isThisActive}
                      style={[
                        styles.deviceItem,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: isThisActive ? '#10B981' : theme.borderColor,
                        },
                      ]}
                    >
                      <View style={[styles.deviceIconBox, { backgroundColor: 'rgba(100, 116, 139, 0.12)' }]}>
                        <Printer size={18} color={theme.textSecondary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.deviceName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {d.name || `Device (${d.id.slice(-6)})`}
                        </Text>
                        <Text style={[styles.deviceMac, { color: theme.textSecondary }]}>
                          {d.macAddress || d.id}
                        </Text>
                      </View>

                      {isThisConnecting ? (
                        <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                      ) : isThisActive ? (
                        <CheckCircle2 size={16} color="#10B981" />
                      ) : (
                        <View style={styles.connectBtnSmall}>
                          <Text style={styles.connectBtnSmallText}>Pair & Connect</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            {showContinueWithoutPrinter ? (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  if (onContinueWithoutPrinter) onContinueWithoutPrinter();
                }}
                style={[styles.continueBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <Share2 size={14} color={theme.textSecondary} />
                <Text style={[styles.continueBtnText, { color: theme.textPrimary }]}>Continue without Printer</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity onPress={onClose} style={[styles.dismissBtn, { backgroundColor: BRAND_COLORS.blue600 }]}>
              <Text style={styles.dismissBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 6,
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  warningText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  scrollList: {
    maxHeight: 360,
    marginVertical: 6,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  scanRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanRefreshText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_COLORS.blue600,
    marginLeft: 4,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  deviceIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '800',
  },
  deviceMac: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  defaultBadge: {
    backgroundColor: '#10B981',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  connectBtnSmall: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  connectBtnSmallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  scanningPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  scanningPlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  emptyText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  continueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  continueBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  dismissBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
