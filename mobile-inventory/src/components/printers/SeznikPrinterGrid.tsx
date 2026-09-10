import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Zap,
  Printer,
  FileText,
  Tag,
  Radio,
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

interface SeznikPrinterGridProps {
  onSelectModel?: (model: SeznikPrinterModel) => void;
  selectedModelId?: SeznikPrinterModelId | null;
  showWarnings?: boolean;
}

export const SeznikPrinterGrid: React.FC<SeznikPrinterGridProps> = ({
  onSelectModel,
  selectedModelId,
  showWarnings = true,
}) => {
  const theme = useAppTheme();
  const {
    activeDevice,
    connectionState,
    connectedPrinterModel,
    setConnectedPrinterModel,
    disconnectDevice,
  } = usePrinterStore();

  const [joshConnected, setJoshConnected] = useState(false);
  const [tejConnected, setTejConnected] = useState(false);

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

  return (
    <View style={styles.container}>
      {PRINTER_MODEL_LIST.map((model) => {
        const status = getModelStatus(model);
        const isConnected = status === 'connected';
        const isSelected = selectedModelId === model.id || (connectedPrinterModel === model.id && isConnected);

        return (
          <TouchableOpacity
            key={model.id}
            activeOpacity={0.88}
            onPress={() => handleSelect(model)}
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
            <View style={styles.cardHeader}>
              <View style={styles.imageContainer}>
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

                <View style={styles.driverRow}>
                  <Text style={[styles.driverText, { color: theme.textSecondary }]}>
                    Driver: <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{model.driver}</Text>
                  </Text>
                </View>

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
            </View>

            {showWarnings && model.warningNotice ? (
              <View
                style={[
                  styles.warningBox,
                  {
                    backgroundColor: model.id === 'veer' ? '#FFFBEB' : '#F8FAFC',
                    borderColor: model.id === 'veer' ? '#FDE68A' : theme.borderColor,
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
                    { color: model.id === 'veer' ? '#B45309' : theme.textSecondary },
                  ]}
                >
                  {model.warningNotice}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
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
    backgroundColor: '#F1F5F9',
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
