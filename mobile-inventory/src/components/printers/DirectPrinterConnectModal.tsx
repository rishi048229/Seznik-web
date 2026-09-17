import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  PermissionsAndroid,
  NativeModules,
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
  ChevronDown,
  AlertTriangle,
  Zap,
  Tag,
  Layers,
  Power,
  FileText,
} from 'lucide-react-native';
import { usePrinterStore, PhoneBluetoothDevice } from '@/store/usePrinterStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';
import {
  PRINTER_MODEL_LIST,
  SEZNIK_PRINTER_MODELS,
  SeznikPrinterModelId,
  SeznikPrinterModel,
} from '@/constants/printerModels';
import ThermalPrinterService from '@/services/PrinterService';
import JoshLabelPrinter, { isJoshPrinterSupported, JoshPrinterDevice } from '../../../modules/josh-label-printer';

interface DirectPrinterConnectModalProps {
  visible: boolean;
  onClose: () => void;
  /** Optional callback fired automatically once a printer is successfully connected */
  onConnected?: () => void;
  title?: string;
  subtitle?: string;
  showContinueWithoutPrinter?: boolean;
  onContinueWithoutPrinter?: () => void;
  continueWithoutPrinterLabel?: string;
  initialModelId?: SeznikPrinterModelId;
}

export const DirectPrinterConnectModal: React.FC<DirectPrinterConnectModalProps> = ({
  visible,
  onClose,
  onConnected,
  title,
  subtitle,
  showContinueWithoutPrinter = true,
  onContinueWithoutPrinter,
  continueWithoutPrinterLabel,
  initialModelId = 'josh',
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();

  const {
    connectionState,
    activeDevice,
    pairedPrinters,
    scannedDevices,
    isScanning,
    scanForDevices,
    connectDevice,
    disconnectDevice,
    connectedPrinterModel,
    setConnectedPrinterModel,
    warningText,
  } = usePrinterStore(
    useShallow((s) => ({
      connectionState: s.connectionState,
      activeDevice: s.activeDevice,
      pairedPrinters: s.pairedPrinters,
      scannedDevices: s.scannedDevices,
      isScanning: s.isScanning,
      scanForDevices: s.scanForDevices,
      connectDevice: s.connectDevice,
      disconnectDevice: s.disconnectDevice,
      connectedPrinterModel: s.connectedPrinterModel,
      setConnectedPrinterModel: s.setConnectedPrinterModel,
      warningText: s.warningText,
    }))
  );

  const [selectedModel, setSelectedModel] = useState<SeznikPrinterModelId>(
    connectedPrinterModel || initialModelId
  );

  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Josh SDK state
  const [joshDevices, setJoshDevices] = useState<JoshPrinterDevice[]>([]);
  const [isJoshScanning, setIsJoshScanning] = useState(false);
  const [joshConnectedDevice, setJoshConnectedDevice] = useState<{ address: string; name: string } | null>(null);

  const VISIBLE_DEVICE_LIMIT = 5;
  const [showAllDevices, setShowAllDevices] = useState(false);

  // Sync selected model if connectedPrinterModel changes
  useEffect(() => {
    if (connectedPrinterModel) {
      setSelectedModel(connectedPrinterModel);
    }
  }, [connectedPrinterModel]);

  // Refresh status of all bridges
  const refreshAllStatuses = useCallback(async () => {
    if (ThermalPrinterService.isJoshSupported() && JoshLabelPrinter) {
      try {
        const isConn = await JoshLabelPrinter.isConnected();
        if (isConn) {
          const info = await JoshLabelPrinter.getPrinterInfo();
          setJoshConnectedDevice(info ? { address: info.address, name: info.name } : null);
        } else {
          setJoshConnectedDevice(null);
        }
      } catch {
        setJoshConnectedDevice(null);
      }
    }
  }, []);

  const ensureAndroidPermissions = async (): Promise<boolean> => {
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

  const scanJoshDevices = async () => {
    // 1. Immediately seed paired & scanned Bluetooth devices from store
    const storeDevices = [...(pairedPrinters || []), ...(scannedDevices || [])];
    const initialList: JoshPrinterDevice[] = storeDevices.map((d) => ({ address: d.id, name: d.name }));
    setJoshDevices((prev) => {
      const combined = [...prev];
      for (const d of initialList) {
        if (d.address && !combined.some((x) => x.address === d.address)) {
          combined.push(d);
        }
      }
      return combined;
    });

    if (scanForDevices) {
      scanForDevices().catch(() => {});
    }

    if (!ThermalPrinterService.isJoshSupported() || !JoshLabelPrinter) return;
    const ok = await ensureAndroidPermissions();
    if (!ok) return;
    setIsJoshScanning(true);
    try {
      const paired = await JoshLabelPrinter.getPairedPrinters();
      if (paired && paired.length > 0) {
        setJoshDevices((prev) => {
          const combined = [...prev];
          for (const d of paired) {
            if (d.address && !combined.some((x) => x.address === d.address)) {
              combined.push(d);
            }
          }
          return combined;
        });
      }
      await JoshLabelPrinter.startDiscovery();
      setTimeout(() => {
        try {
          JoshLabelPrinter?.stopDiscovery().catch(() => {});
        } catch {}
        setIsJoshScanning(false);
      }, 8000);
    } catch (e) {
      console.log('[Josh] scan failed:', e);
      setIsJoshScanning(false);
    }
  };

  useEffect(() => {
    if (visible) {
      refreshAllStatuses();
      if (selectedModel === 'veer' || selectedModel === 'dev') {
        if (connectionState !== 'connected') {
          scanForDevices().catch(() => {});
        }
      } else if (selectedModel === 'josh') {
        scanJoshDevices();
      }
    }
  }, [visible, selectedModel]);

  // Listeners for Josh
  useEffect(() => {
    if (!ThermalPrinterService.isJoshSupported() || !JoshLabelPrinter) return;
    const foundSub = JoshLabelPrinter.addListener('onPrinterFound', (device) => {
      setJoshDevices((prev) => {
        const exists = prev.some((d) => d.address === device.address);
        return exists ? prev : [...prev, device];
      });
    });
    const stateSub = JoshLabelPrinter.addListener('onPrinterStateChange', () => {
      refreshAllStatuses();
    });
    return () => {
      foundSub.remove();
      stateSub.remove();
    };
  }, [refreshAllStatuses]);

  // Connect ESC/POS (VEER / DEV)
  const handleConnectEscPos = async (device: PhoneBluetoothDevice, modelId: 'dev' | 'veer') => {
    setConnectingId(device.id);
    try {
      // Clean disconnect conflicting bridges
      if (ThermalPrinterService.isJoshSupported()) {
        ThermalPrinterService.joshDisconnect().catch(() => {});
      }

      setConnectedPrinterModel(modelId);
      await connectDevice(device.id, device.name);
      if (onConnected) onConnected();
      onClose();
    } catch (e: any) {
      Alert.alert(
        t('connectionFailed', 'Connection Failed'),
        e?.message || t('connectionFailedSub', 'Could not reach the printer. Check that it is switched on and in range.'),
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          { text: t('retry', 'Retry'), onPress: () => handleConnectEscPos(device, modelId) },
        ]
      );
    } finally {
      setConnectingId(null);
    }
  };

  // Connect JOSH (LPAPI)
  const handleConnectJosh = async (device: JoshPrinterDevice) => {
    setConnectingId(device.address);
    const devName = (device.name || '').toLowerCase();
    try {
      // Clean disconnect conflicting bridges
      disconnectDevice().catch(() => {});

      // If user tapped a third-party POS / DEV printer while on JOSH tab, route to DEV ESC/POS directly
      if (devName.includes('shakti') || devName.includes('dev') || devName.includes('pos-')) {
        setConnectedPrinterModel('dev');
        await connectDevice(device.address, device.name);
        await refreshAllStatuses();
        if (onConnected) onConnected();
        onClose();
        return;
      }

      // Standard JOSH LPAPI connection attempt
      setConnectedPrinterModel('josh');
      const ok = await ThermalPrinterService.joshConnect(device.address, device.name);

      if (!ok) {
        setConnectedPrinterModel(null as any);
        throw new Error(
          `Could not connect to SEZNIK JOSH (${device.name || device.address}). Please ensure the printer is turned ON, paired in phone Settings > Bluetooth, and within Bluetooth range.`
        );
      }
      await refreshAllStatuses();
      if (onConnected) onConnected();
      onClose();
    } catch (e: any) {
      Alert.alert(
        'Connection Failed',
        e?.message || 'Could not establish connection to SEZNIK JOSH. Please check that printer is paired in phone Settings > Bluetooth.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleConnectJosh(device) },
        ]
      );
    } finally {
      setConnectingId(null);
    }
  };

  // --- DISCONNECT handler ---
  const handleDisconnect = async () => {
    try {
      if (selectedModel === 'josh') {
        await ThermalPrinterService.joshDisconnect();
        setJoshConnectedDevice(null);
      } else {
        await disconnectDevice();
      }
      setConnectedPrinterModel(null as any);
      await refreshAllStatuses();
      Alert.alert('Disconnected', `${SEZNIK_PRINTER_MODELS[selectedModel].name} has been disconnected.`);
    } catch (e: any) {
      Alert.alert('Disconnect Error', e?.message || 'Could not disconnect.');
    }
  };

  // --- TEST PRINT handler (asks Receipt or Label for JOSH, Receipt-only for others) ---
  const handleTestPrint = () => {
    const modelConfig = SEZNIK_PRINTER_MODELS[selectedModel];
    const supportsLabels = modelConfig.capabilities.labels;

    if (!supportsLabels || modelConfig.isNonSeznik) {
      // Non-SEZNIK or receipt-only: print test receipt directly
      doTestPrint('receipt');
      return;
    }

    Alert.alert(
      'Test Print',
      'What would you like to print for testing?',
      [
        {
          text: 'Receipt',
          onPress: () => doTestPrint('receipt'),
        },
        {
          text: 'Label',
          onPress: () => doTestPrint('label'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const doTestPrint = async (type: 'receipt' | 'label') => {
    try {
      if (type === 'receipt') {
        await ThermalPrinterService.printTestReceipt();
        Alert.alert('✅ Test Receipt Sent', 'Check your printer output.');
      } else {
        await ThermalPrinterService.printTestLabel();
        Alert.alert('✅ Test Label Sent', 'Check your printer output.');
      }
    } catch (e: any) {
      Alert.alert('Test Print Failed', e?.message || 'Could not complete test print.');
    }
  };

  const handleScanAgain = () => {
    if (selectedModel === 'veer' || selectedModel === 'dev') {
      scanForDevices().catch(() => {});
    } else if (selectedModel === 'josh') {
      scanJoshDevices();
    }
  };

  const activeModelConfig = SEZNIK_PRINTER_MODELS[selectedModel];

  // Helper to determine if selected model is connected
  const isSelectedModelConnected =
    (selectedModel === 'josh' && !!joshConnectedDevice) ||
    ((selectedModel === 'dev' || selectedModel === 'veer') &&
      connectionState === 'connected' &&
      (connectedPrinterModel === selectedModel || (!connectedPrinterModel && selectedModel === 'dev')));

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
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  {title || 'Connect Bluetooth Printer'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {subtitle || 'Select your printer model below to link via Bluetooth'}
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

          {/* PRINTER MODEL SELECTOR ROW */}
          <View style={styles.modelSelectorContainer}>
            {PRINTER_MODEL_LIST.map((model) => {
              const isSelected = selectedModel === model.id;
              const isConn =
                (model.id === 'josh' && !!joshConnectedDevice) ||
                ((model.id === 'dev' || model.id === 'veer') &&
                  connectionState === 'connected' &&
                  (connectedPrinterModel === model.id || (!connectedPrinterModel && model.id === 'dev')));

              return (
                <TouchableOpacity
                  key={model.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedModel(model.id)}
                  style={[
                    styles.modelTab,
                    {
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : theme.cardBg,
                      borderColor: isConn
                        ? '#10B981'
                        : isSelected
                        ? BRAND_COLORS.blue600
                        : theme.borderColor,
                      borderWidth: isSelected || isConn ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.tabImageWrap}>
                    <Image source={model.image} style={styles.tabImage} resizeMode="contain" />
                    {isConn && (
                      <View style={styles.connectedDotBadge}>
                        <View style={styles.connectedDot} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tabName,
                      {
                        color: isSelected ? BRAND_COLORS.blue600 : theme.textPrimary,
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {model.id === 'josh' ? 'SEZNIK JOSH' : model.name.replace('Other Printer (', '').replace(')', '')}
                  </Text>
                  <Text
                    style={[
                      styles.tabType,
                      { color: model.isNonSeznik ? '#D97706' : '#7C3AED' },
                    ]}
                    numberOfLines={1}
                  >
                    {model.id === 'josh' ? 'Official 2-in-1' : 'Receipt Only'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* CLEAN MODEL INFO / WARNING BANNER */}
          <View
            style={[
              styles.modelNoticeBox,
              {
                backgroundColor:
                  activeModelConfig.isNonSeznik
                    ? (theme.isDark ? 'rgba(217, 119, 6, 0.12)' : '#FFFBEB')
                    : (theme.isDark ? 'rgba(124, 58, 237, 0.1)' : '#F5F3FF'),
                borderColor:
                  activeModelConfig.isNonSeznik
                    ? (theme.isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A')
                    : (theme.isDark ? 'rgba(124, 58, 237, 0.3)' : '#DDD6FE'),
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              {activeModelConfig.isNonSeznik ? (
                <AlertTriangle size={15} color="#D97706" style={{ marginRight: 6 }} />
              ) : (
                <Zap size={15} color="#7C3AED" style={{ marginRight: 6 }} />
              )}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: activeModelConfig.isNonSeznik ? '#B45309' : '#7C3AED',
                }}
              >
                {activeModelConfig.name} • {activeModelConfig.typeBadge}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 11,
                color: activeModelConfig.isNonSeznik ? '#92400E' : theme.textSecondary,
                lineHeight: 15,
              }}
            >
              {activeModelConfig.isNonSeznik
                ? '⚠️ Non-SEZNIK Printer: This printer is a third-party non-SEZNIK device. Only receipt printing is supported. Label printing is exclusive to official SEZNIK hardware.'
                : 'Supports high-precision die-cut labels and receipts with hardware optical gap detection.'}
            </Text>
          </View>

          {/* Warning Banner if any store warning */}
          {warningText && !isSelectedModelConnected ? (
            <View style={[styles.warningBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <AlertCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.warningText}>{warningText}</Text>
            </View>
          ) : null}

          {/* CONNECTED STATUS + DISCONNECT / TEST BUTTONS */}
          {isSelectedModelConnected && (
            <View style={styles.connectedActionsRow}>
              <View style={styles.connectedStatusBox}>
                <CheckCircle2 size={16} color="#10B981" />
                <Text style={styles.connectedStatusText}>
                  {activeModelConfig.name} Connected
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleTestPrint}
                  style={[styles.actionBtnSmall, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}
                >
                  <FileText size={13} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.actionBtnSmallText, { color: BRAND_COLORS.blue600 }]}>Test</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDisconnect}
                  style={[styles.actionBtnSmall, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                >
                  <Power size={13} color="#EF4444" />
                  <Text style={[styles.actionBtnSmallText, { color: '#EF4444' }]}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* DEVICE LIST SCROLL */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={{ paddingVertical: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ESC/POS (DEV / VEER) LIST */}
            {(selectedModel === 'dev' || selectedModel === 'veer') && (
              <>
                {/* PAIRED PRINTERS */}
                {pairedPrinters.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      SAVED / PAIRED PRINTERS ({pairedPrinters.length})
                    </Text>
                    {pairedPrinters.map((p) => {
                      const isThisConnecting = connectingId === p.id;
                      const isThisActive =
                        activeDevice?.id === p.id &&
                        connectionState === 'connected' &&
                        (connectedPrinterModel === selectedModel || (!connectedPrinterModel && selectedModel === 'dev'));

                      return (
                        <TouchableOpacity
                          key={p.id}
                          activeOpacity={0.8}
                          onPress={() => handleConnectEscPos(p, selectedModel)}
                          disabled={isThisConnecting || isThisActive}
                          style={[
                            styles.deviceItem,
                            {
                              backgroundColor: theme.cardBg,
                              borderColor: isThisActive ? '#10B981' : theme.borderColor,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.deviceIconBox,
                              {
                                backgroundColor: isThisActive
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(37, 99, 235, 0.1)',
                              },
                            ]}
                          >
                            <Printer
                              size={18}
                              color={isThisActive ? '#10B981' : BRAND_COLORS.blue600}
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text
                                style={[styles.deviceName, { color: theme.textPrimary }]}
                                numberOfLines={1}
                              >
                                {p.name || 'Bluetooth Printer'}
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
                              <Text
                                style={{
                                  color: '#10B981',
                                  fontSize: 11,
                                  fontWeight: '800',
                                  marginLeft: 4,
                                }}
                              >
                                Ready
                              </Text>
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
                <View
                  style={[styles.section, { marginTop: pairedPrinters.length > 0 ? 10 : 0 }]}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      NEARBY BLUETOOTH DEVICES ({scannedDevices.length})
                    </Text>
                    <TouchableOpacity
                      onPress={handleScanAgain}
                      disabled={isScanning}
                      style={styles.scanRefreshBtn}
                    >
                      <RefreshCw
                        size={12}
                        color={BRAND_COLORS.blue600}
                        style={isScanning ? { transform: [{ rotate: '45deg' }] } : {}}
                      />
                      <Text style={styles.scanRefreshText}>
                        {isScanning ? 'Scanning...' : 'Scan Again'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isScanning && scannedDevices.length === 0 ? (
                    <View style={styles.scanningPlaceholder}>
                      <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                      <Text
                        style={[
                          styles.scanningPlaceholderText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Searching for nearby Bluetooth printers...
                      </Text>
                    </View>
                  ) : scannedDevices.length === 0 ? (
                    <View style={[styles.emptyBox, { borderColor: theme.borderColor }]}>
                      <Smartphone size={22} color={theme.textSecondary} />
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        No devices found. Turn ON printer and pair it in phone Bluetooth settings.
                      </Text>
                    </View>
                  ) : (
                    (showAllDevices
                      ? scannedDevices
                      : scannedDevices.slice(0, VISIBLE_DEVICE_LIMIT)
                    ).map((d) => {
                      const isThisConnecting = connectingId === d.id;
                      const isThisActive =
                        activeDevice?.id === d.id &&
                        connectionState === 'connected' &&
                        (connectedPrinterModel === selectedModel || (!connectedPrinterModel && selectedModel === 'dev'));

                      return (
                        <TouchableOpacity
                          key={d.id}
                          activeOpacity={0.8}
                          onPress={() => handleConnectEscPos(d, selectedModel)}
                          disabled={isThisConnecting || isThisActive}
                          style={[
                            styles.deviceItem,
                            {
                              backgroundColor: theme.cardBg,
                              borderColor: isThisActive ? '#10B981' : theme.borderColor,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.deviceIconBox,
                              { backgroundColor: 'rgba(100, 116, 139, 0.12)' },
                            ]}
                          >
                            <Printer size={18} color={theme.textSecondary} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text
                              style={[styles.deviceName, { color: theme.textPrimary }]}
                              numberOfLines={1}
                            >
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

                  {!showAllDevices && scannedDevices.length > VISIBLE_DEVICE_LIMIT ? (
                    <TouchableOpacity
                      onPress={() => setShowAllDevices(true)}
                      style={[styles.showMoreBtn, { borderColor: theme.borderColor }]}
                    >
                      <ChevronDown size={15} color={theme.textPrimary} />
                      <Text style={[styles.showMoreText, { color: theme.textPrimary }]}>
                        Show {scannedDevices.length - VISIBLE_DEVICE_LIMIT} more device
                        {scannedDevices.length - VISIBLE_DEVICE_LIMIT === 1 ? '' : 's'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}

            {/* JOSH LPAPI LIST */}
            {selectedModel === 'josh' && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    JOSH PRINTERS ({joshDevices.length})
                  </Text>
                  <TouchableOpacity
                    onPress={scanJoshDevices}
                    disabled={isJoshScanning}
                    style={styles.scanRefreshBtn}
                  >
                    <RefreshCw
                      size={12}
                      color="#7C3AED"
                      style={isJoshScanning ? { transform: [{ rotate: '45deg' }] } : {}}
                    />
                    <Text style={[styles.scanRefreshText, { color: '#7C3AED' }]}>
                      {isJoshScanning ? 'Scanning...' : 'Scan'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isJoshScanning && joshDevices.length === 0 ? (
                  <View style={styles.scanningPlaceholder}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text
                      style={[styles.scanningPlaceholderText, { color: theme.textSecondary }]}
                    >
                      Searching for nearby SEZNIK JOSH printers...
                    </Text>
                  </View>
                ) : joshDevices.length === 0 ? (
                  <View style={[styles.emptyBox, { borderColor: theme.borderColor }]}>
                    <Smartphone size={22} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No JOSH printers found. Ensure SEZNIK JOSH is powered on and within range.
                    </Text>
                  </View>
                ) : (
                  joshDevices.map((d) => {
                    const isThisConnecting = connectingId === d.address;
                    const isThisActive =
                      joshConnectedDevice?.address === d.address ||
                      (connectedPrinterModel === 'josh' && !!joshConnectedDevice);

                    return (
                      <TouchableOpacity
                        key={d.address}
                        activeOpacity={0.8}
                        onPress={() => handleConnectJosh(d)}
                        disabled={isThisConnecting || isThisActive}
                        style={[
                          styles.deviceItem,
                          {
                            backgroundColor: theme.cardBg,
                            borderColor: isThisActive ? '#10B981' : theme.borderColor,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.deviceIconBox,
                            {
                              backgroundColor: isThisActive
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(124, 58, 237, 0.12)',
                            },
                          ]}
                        >
                          <Tag
                            size={18}
                            color={isThisActive ? '#10B981' : '#7C3AED'}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text
                            style={[styles.deviceName, { color: theme.textPrimary }]}
                            numberOfLines={1}
                          >
                            {d.name || 'SEZNIK JOSH Printer'}
                          </Text>
                          <Text style={[styles.deviceMac, { color: theme.textSecondary }]}>
                            {d.address}
                          </Text>
                        </View>

                        {isThisConnecting ? (
                          <ActivityIndicator size="small" color="#7C3AED" />
                        ) : isThisActive ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <CheckCircle2 size={16} color="#10B981" />
                            <Text
                              style={{
                                color: '#10B981',
                                fontSize: 11,
                                fontWeight: '800',
                                marginLeft: 4,
                              }}
                            >
                              Ready
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.connectBtnSmall,
                              { backgroundColor: '#7C3AED' },
                            ]}
                          >
                            <Text style={styles.connectBtnSmallText}>Connect</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            {showContinueWithoutPrinter ? (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  if (onContinueWithoutPrinter) onContinueWithoutPrinter();
                }}
                style={[
                  styles.continueBtn,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                ]}
              >
                <CheckCircle2 size={14} color="#10B981" />
                <Text style={[styles.continueBtnText, { color: theme.textPrimary }]}>
                  {continueWithoutPrinterLabel || t('continueWithoutPrinter', 'Continue without Printer')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={onClose}
              style={[styles.dismissBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
            >
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
    padding: 14,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modelSelectorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modelTab: {
    flex: 1,
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabImageWrap: {
    width: 38,
    height: 38,
    position: 'relative',
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabImage: {
    width: 36,
    height: 36,
  },
  connectedDotBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  tabName: {
    fontSize: 11,
    textAlign: 'center',
  },
  tabType: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  modelNoticeBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  warningText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  connectedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  connectedStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectedStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollList: {
    maxHeight: 320,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  scanRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_COLORS.blue600,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '700',
  },
  defaultBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  defaultBadgeText: {
    color: BRAND_COLORS.blue600,
    fontSize: 9,
    fontWeight: '800',
  },
  deviceMac: {
    fontSize: 11,
    marginTop: 2,
  },
  connectBtnSmall: {
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  connectBtnSmallText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  scanningPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  scanningPlaceholderText: {
    fontSize: 12,
  },
  emptyBox: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 6,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    gap: 6,
  },
  showMoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  continueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  continueBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dismissBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  dismissBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
