import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { GstBillingSettingsPanel } from '@/components/billing/GstBillingSettingsPanel';
import { useGstBillingSettings } from '@/hooks/useGstBillingSettings';
import { useAppTheme } from '@/hooks/useAppTheme';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

interface GstBillingSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function GstBillingSettingsModal({ visible, onClose }: GstBillingSettingsModalProps) {
  const theme = useAppTheme();
  const {
    form,
    setShowBreakdown,
    setStyle,
    setPrintOnReceipt,
    setItemWiseGst,
    saveGstBilling,
    isSaving,
  } = useGstBillingSettings();

  const handleSave = async () => {
    try {
      await saveGstBilling({
        onSuccess: () => {
          Alert.alert('Tax & Billing Saved', 'GST breakdown settings apply everywhere — checkout, templates, and receipts.');
          onClose();
        },
      });
    } catch (e: any) {
      Alert.alert('Could Not Save', sanitizeErrorMessage(e, 'Failed to save tax and billing settings. Please try again.'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Tax & Billing</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.cardBg }]}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <GstBillingSettingsPanel
              theme={theme}
              showBreakdown={form.showBreakdown}
              style={form.style}
              printOnReceipt={form.printOnReceipt}
              itemWiseGst={form.itemWiseGst}
              onShowBreakdownChange={setShowBreakdown}
              onStyleChange={setStyle}
              onPrintOnReceiptChange={setPrintOnReceipt}
              onItemWiseGstChange={setItemWiseGst}
              onSave={handleSave}
              isSaving={isSaving}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
});
