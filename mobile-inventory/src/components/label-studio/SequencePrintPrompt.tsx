import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { Hash, Minus, Plus, X } from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { MAX_SEQUENCE_COUNT } from '@/utils/labelSequence';

interface SequencePrintPromptProps {
  visible: boolean;
  defaultPattern?: string;
  isPrinting?: boolean;
  progress?: number;
  onSubmit: (pattern: string, count: number) => void;
  onCancel: () => void;
}

/**
 * One shared prompt for "print a run of labels with an auto-incrementing sequence field" — used
 * from Label Studio's own screen, BarcodePrintModal, and the Printers page's Label test-print
 * button, so the pattern+count UI is written once instead of three separate hand-rolled forms.
 */
export function SequencePrintPrompt({
  visible,
  defaultPattern = '0001',
  isPrinting = false,
  progress = 0,
  onSubmit,
  onCancel,
}: SequencePrintPromptProps) {
  const theme = useAppTheme();
  const [pattern, setPattern] = useState(defaultPattern);
  const [count, setCount] = useState(10);

  useEffect(() => {
    // Deferred to a microtask so this setState doesn't run synchronously inside the effect's
    // commit (React Compiler's set-state-in-effect rule) — resets the input to the default
    // pattern each time the prompt is (re)opened.
    if (!visible) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setPattern(defaultPattern);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, defaultPattern]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Hash size={18} color={BRAND_COLORS.blue600} />
              <Text style={[styles.title, { color: theme.textPrimary }]}>Print a Sequence</Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 14, lineHeight: 16 }}>
            This label has a Sequence Number field. Enter the first label&apos;s number/code — the
            rest auto-increment from it (e.g. &quot;0001&quot;→&quot;0002&quot;, or &quot;A01&quot;→&quot;A02&quot;).
          </Text>

          <Text style={[styles.label, { color: theme.textPrimary }]}>Starting Pattern</Text>
          <TextInput
            value={pattern}
            onChangeText={setPattern}
            style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
            placeholder="e.g. 0001 or A01"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: theme.textPrimary, marginTop: 12 }]}>Count</Text>
          <View style={styles.stepperControls}>
            <TouchableOpacity onPress={() => setCount((v) => Math.max(1, v - 1))} style={[styles.stepBtn, { borderColor: theme.borderColor }]}>
              <Minus size={14} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.stepVal, { color: theme.textPrimary }]}>{count}</Text>
            <TouchableOpacity onPress={() => setCount((v) => Math.min(MAX_SEQUENCE_COUNT, v + 1))} style={[styles.stepBtn, { borderColor: theme.borderColor }]}>
              <Plus size={14} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => onSubmit(pattern, count)}
            disabled={isPrinting || !pattern.trim()}
            style={[styles.submitBtn, { opacity: isPrinting || !pattern.trim() ? 0.6 : 1 }]}
          >
            {isPrinting ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.submitBtnText}>Printing {progress}/{count}...</Text>
              </>
            ) : (
              <>
                <Hash size={16} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Print {count} Labels</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '900', marginLeft: 8 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  stepperControls: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 14, fontWeight: '800', marginHorizontal: 12, minWidth: 30, textAlign: 'center' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND_COLORS.blue600, borderRadius: 12, paddingVertical: 12, marginTop: 18 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginLeft: 8 },
});
