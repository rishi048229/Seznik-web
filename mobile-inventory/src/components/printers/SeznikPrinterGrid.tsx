import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Vibration,
} from 'react-native';
import {
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Zap,
  Printer,
  PowerOff,
} from 'lucide-react-native';
import {
  PRINTER_MODEL_LIST,
  SeznikPrinterModel,
  SeznikPrinterModelId,
} from '@/constants/printerModels';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService from '@/services/PrinterService';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { buildTestReceiptPrintOptions } from '@/utils/fastSaleCheckout';
import { getCachedSettings } from '@/hooks/useSettings';
import { PrinterGlowCard } from '@/components/printers/PrinterGlowCard';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

interface SeznikPrinterGridProps {
  onSelectModel?: (model: SeznikPrinterModel) => void;
  selectedModelId?: SeznikPrinterModelId | null;
  showWarnings?: boolean;
  onTestPrint?: (model: SeznikPrinterModel) => void | Promise<void>;
  onDisconnect?: (model: SeznikPrinterModel) => void | Promise<void>;
}

export const SeznikPrinterGrid: React.FC<SeznikPrinterGridProps> = ({
  onSelectModel,
  selectedModelId,
  showWarnings = true,
  onTestPrint,
  onDisconnect,
}) => {
  const theme = useAppTheme();
  const isDark = theme.isDark;
  const {
    activeDevice,
    connectionState,
    connectedPrinterModel,
    setConnectedPrinterModel,
    disconnectDevice,
  } = usePrinterStore();

  const [joshConnected, setJoshConnected] = useState(false);
  const [tejConnected, setTejConnected] = useState(false);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const refreshSdkStates = async () => {
    try {
      const joshOn = await ThermalPrinterService.joshIsConnected();
      setJoshConnected(joshOn);
      const tejOn = await ThermalPrinterService.yxIsConnected();
      setTejConnected(tejOn);
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    refreshSdkStates();
    const interval = setInterval(refreshSdkStates, 3000);
    return () => clearInterval(interval);
  }, []);

  const getModelStatus = (model: SeznikPrinterModel) => {
    if (model.id === 'josh') {
      return joshConnected ? 'connected' : 'disconnected';
    }
    if (model.id === 'tej') {
      return tejConnected ? 'connected' : 'disconnected';
    }
    // veer and dev use ESC/POS
    if (connectionState === 'connected') {
      if (connectedPrinterModel === model.id) return 'connected';
      if (!connectedPrinterModel) {
        // default escpos to dev if unspecified
        return model.id === 'dev' ? 'connected' : 'disconnected';
      }
    }
    return 'disconnected';
  };

  const handleSelect = async (model: SeznikPrinterModel) => {
    setConnectedPrinterModel(model.id);

    // Clean disconnect of conflicting bridges when switching models
    if (model.id === 'josh') {
      if (tejConnected) ThermalPrinterService.yxDisconnect().catch(() => {});
      if (connectionState === 'connected') disconnectDevice().catch(() => {});
    } else if (model.id === 'tej') {
      if (joshConnected) ThermalPrinterService.joshDisconnect().catch(() => {});
      if (connectionState === 'connected') disconnectDevice().catch(() => {});
    } else {
      // veer or dev (ESC/POS)
      if (joshConnected) ThermalPrinterService.joshDisconnect().catch(() => {});
      if (tejConnected) ThermalPrinterService.yxDisconnect().catch(() => {});
    }

    if (onSelectModel) {
      onSelectModel(model);
    }
  };

  const handleInternalDisconnect = async (model: SeznikPrinterModel) => {
    setIsDisconnecting(true);
    try {
      if (onDisconnect) {
        await onDisconnect(model);
      } else {
        await disconnectDevice();
      }
      setJoshConnected(false);
      setTejConnected(false);
      try { Vibration.vibrate(60); } catch (e) {}
    } catch (e) {
      // Ignored
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleInternalTestPrint = async (model: SeznikPrinterModel) => {
    setIsPrintingTest(true);
    try {
      if (onTestPrint) {
        await onTestPrint(model);
      } else {
        if (model.id === 'josh' || model.id === 'tej') {
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
          if (ok) {
            Alert.alert('Test Label Sent!', `Printed test label via ${model.name}.`);
          } else {
            Alert.alert('Print Failed', `Could not send test label to ${model.name}.`);
          }
        } else {
          const {
            paperWidth,
            activeTemplateId,
            customTemplates,
            activeCustomTemplateId,
            enableBillQrCode,
            topMargin,
            autoCut,
            fontSize,
          } = usePrinterStore.getState();
          await ThermalPrinterService.printTestReceipt(
            paperWidth,
            buildTestReceiptPrintOptions({
              activeTemplateId,
              customTemplates,
              activeCustomTemplateId,
              enableBillQrCode,
              topMargin,
              autoCut,
              fontSize,
              settings: getCachedSettings(),
              copies: 1,
            })
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Print Error', sanitizeErrorMessage(err, 'Failed to print test receipt. Please verify printer connection and paper roll.'));
    } finally {
      setIsPrintingTest(false);
    }
  };

  // When a printer is connected, hide the rest of the printer options; when disconnected, show all models.
  const connectedModel = PRINTER_MODEL_LIST.find((model) => getModelStatus(model) === 'connected');
  const modelsToRender = connectedModel ? [connectedModel] : PRINTER_MODEL_LIST;

  return (
    <View style={styles.container}>
      {modelsToRender.map((model) => {
        const status = getModelStatus(model);
        const isConnected = status === 'connected';
        const isSelected = selectedModelId === model.id || (connectedPrinterModel === model.id && isConnected);

        return (
          <PrinterGlowCard
            key={model.id}
            active={isConnected}
            highlighted={isSelected && !isConnected}
            glowColor={isConnected ? '#10B981' : BRAND_COLORS.blue600}
            borderRadius={16}
          >
          <View
            style={[
              styles.modelCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: isConnected
                  ? '#10B981'
                  : isSelected
                  ? BRAND_COLORS.blue600
                  : theme.borderColor,
                borderWidth: isConnected || isSelected ? 2 : 1,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={isConnected ? 1 : 0.88}
              onPress={() => {
                if (!isConnected) {
                  handleSelect(model);
                }
              }}
              style={styles.cardHeader}
            >
              <View style={[styles.imageContainer, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <Image
                  source={model.image}
                  style={styles.printerImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.infoContainer}>
                <View style={styles.titleRow}>
                  <Text style={[styles.modelName, { color: theme.textPrimary }]}>
                    {model.name}
                  </Text>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: model.badgeColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: model.badgeTextColor },
                      ]}
                    >
                      {model.typeBadge}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.tagline, { color: theme.textSecondary }]}>
                  {model.tagline}
                </Text>

                {isConnected && activeDevice?.name ? (
                  <View style={styles.driverRow}>
                    <Text style={[styles.driverText, { color: theme.textSecondary }]}>
                      Device: <Text style={{ fontWeight: '700', color: isDark ? '#38BDF8' : BRAND_COLORS.blue600 }}>{activeDevice.name}</Text>
                    </Text>
                  </View>
                ) : (
                  <View style={styles.driverRow}>
                    <Text style={[styles.driverText, { color: theme.textSecondary }]}>
                      Driver: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{model.driver}</Text>
                    </Text>
                  </View>
                )}

                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isConnected ? '#10B981' : '#94A3B8' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: isConnected ? '#10B981' : theme.textSecondary },
                    ]}
                  >
                    {isConnected ? 'Active & Connected' : 'Ready to Connect'}
                  </Text>
                </View>
              </View>

              <View style={styles.actionArrow}>
                {isConnected ? (
                  <CheckCircle2 size={22} color="#10B981" />
                ) : (
                  <ChevronRight size={20} color={theme.textSecondary} />
                )}
              </View>
            </TouchableOpacity>

            {/* When connected, provide Test Print and Disconnect buttons */}
            {isConnected ? (
              <View style={[styles.connectedActionsRow, { borderTopColor: isDark ? '#1F2937' : '#E2E8F0' }]}>
                <TouchableOpacity
                  style={[
                    styles.testPrintBtn,
                    {
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE',
                    },
                  ]}
                  onPress={() => handleInternalTestPrint(model)}
                  disabled={isPrintingTest}
                  activeOpacity={0.7}
                >
                  {isPrintingTest ? (
                    <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
                  ) : (
                    <>
                      <Printer size={15} color={BRAND_COLORS.blue600} style={{ marginRight: 6 }} />
                      <Text style={[styles.testPrintBtnText, { color: BRAND_COLORS.blue600 }]}>
                        Test Print
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.disconnectBtn,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                    },
                  ]}
                  onPress={() => handleInternalDisconnect(model)}
                  disabled={isDisconnecting}
                  activeOpacity={0.7}
                >
                  {isDisconnecting ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <PowerOff size={14} color="#EF4444" style={{ marginRight: 6 }} />
                      <Text style={styles.disconnectBtnText}>
                        Disconnect
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {!isConnected && showWarnings && model.warningNotice ? (
              <View
                style={[
                  styles.warningBox,
                  {
                    backgroundColor: model.id === 'veer' ? (isDark ? 'rgba(217, 119, 6, 0.12)' : '#FFFBEB') : (isDark ? 'rgba(37, 99, 235, 0.08)' : '#F8FAFC'),
                    borderColor: model.id === 'veer' ? (isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A') : theme.borderColor,
                  },
                ]}
              >
                {model.id === 'veer' ? (
                  <AlertTriangle size={14} color="#D97706" style={{ marginRight: 6, marginTop: 1 }} />
                ) : (
                  <Zap size={14} color={BRAND_COLORS.blue600} style={{ marginRight: 6, marginTop: 1 }} />
                )}
                <Text
                  style={[
                    styles.warningText,
                    { color: model.id === 'veer' ? (isDark ? '#FBBF24' : '#B45309') : theme.textSecondary },
                  ]}
                >
                  {model.warningNotice}
                </Text>
              </View>
            ) : null}
          </View>
          </PrinterGlowCard>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  modelCard: {
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    width: 68,
    height: 68,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    padding: 4,
  },
  printerImage: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 12,
    marginBottom: 4,
  },
  driverRow: {
    marginBottom: 4,
  },
  driverText: {
    fontSize: 11,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionArrow: {
    marginLeft: 8,
  },
  connectedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  testPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  testPrintBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  disconnectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  disconnectBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
});
