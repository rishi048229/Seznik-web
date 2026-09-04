import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { X, Package, Plus, Minus, Save } from 'lucide-react-native';
import { Product } from '@/types/product';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { usesStockTracking } from '@/utils/businessFeatures';

interface PosProductSheetProps {
  visible: boolean;
  /** null = creating a new product; a product = editing that one. */
  product: Product | null;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (args: { id: string; payload: Record<string, unknown> }) => Promise<unknown>;
  onAdjustStock: (args: { id: string; quantity: number; reason: string }) => Promise<unknown>;
}

/**
 * Add or correct a product without leaving the billing counter.
 *
 * The common cases mid-sale are narrow — a wrong price, a stock count that drifted,
 * or an item that was never entered — and each of them previously meant abandoning
 * the cart to go to the Products tab. Only the fields worth touching at a counter
 * are here; anything deeper still belongs on the full product screen.
 */
export function PosProductSheet({
  visible,
  product,
  onClose,
  onCreate,
  onUpdate,
  onAdjustStock,
}: PosProductSheetProps) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { settings } = useSettings();
  const trackStock = usesStockTracking(user?.businessType, settings?.trackStock);
  const isEditing = !!product;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [stock, setStock] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reseeded whenever a different product is opened, so the sheet never shows the
  // previous product's values for a moment. Done as a conditional setState during
  // render (React's documented "adjust state when a prop changes" pattern) rather
  // than an effect, which would paint the previous product's values for one frame
  // before correcting them.
  const seedKey = `${visible ? 'open' : 'closed'}:${product?.id ?? 'new'}`;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (visible && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setName(product?.name ?? '');
    setPrice(product ? String(product.sellingPrice ?? '') : '');
    setCostPrice(product ? String(product.costPrice ?? '') : '');
    setBarcode(product?.barcode ?? '');
    setStock(product ? String(product.currentStock ?? 0) : '0');
  }

  const stockNum = Number(stock) || 0;

  const bumpStock = (delta: number) => {
    setStock(String(Math.max(0, stockNum + delta)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Give this product a name.');
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      Alert.alert('Price Required', 'Enter a valid selling price.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && product) {
        await onUpdate({
          id: product.id,
          payload: {
            name: name.trim(),
            sellingPrice: priceNum,
            costPrice: Number(costPrice) || 0,
            barcode: barcode.trim() || undefined,
          },
        });

        // Stock goes through adjustStock rather than a plain field write so the
        // change is recorded as stock history like every other correction.
        if (trackStock) {
          const delta = stockNum - (product.currentStock ?? 0);
          if (delta !== 0) {
            await onAdjustStock({ id: product.id, quantity: delta, reason: 'Corrected from POS' });
          }
        }
      } else {
        await onCreate({
          name: name.trim(),
          sellingPrice: priceNum,
          costPrice: Number(costPrice) || 0,
          barcode: barcode.trim() || undefined,
          currentStock: trackStock ? stockNum : 999999,
          lowStockThreshold: trackStock ? 5 : 0,
          unit: 'Pc',
          taxRate: 0,
        });
      }
      onClose();
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingWrapper inModal>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                <View style={styles.iconBadge}>
                  <Package size={17} color={BRAND_COLORS.blue600} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
                    {isEditing ? 'Edit Product' : 'New Product'}
                  </Text>
                  <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                    {isEditing ? product?.name : 'Add it and keep billing'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Product name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Aata 5kg"
                placeholderTextColor="#94A3B8"
                autoFocus={!isEditing}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Selling price ₹</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Cost price ₹</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                    value={costPrice}
                    onChangeText={setCostPrice}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Barcode (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Scan or type"
                placeholderTextColor="#94A3B8"
              />

              {trackStock ? (
                <>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    {isEditing ? 'Stock on hand' : 'Opening stock'}
                  </Text>
                  <View style={styles.stockRow}>
                    <TouchableOpacity
                      onPress={() => bumpStock(-1)}
                      style={[styles.stockBtn, { borderColor: theme.borderColor }]}
                    >
                      <Minus size={16} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.stockInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                      value={stock}
                      onChangeText={setStock}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      onPress={() => bumpStock(1)}
                      style={[styles.stockBtn, { borderColor: theme.borderColor }]}
                    >
                      <Plus size={16} color={theme.textPrimary} />
                    </TouchableOpacity>
                    {[10, 50].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => bumpStock(n)}
                        style={[styles.quickStockChip, { borderColor: theme.borderColor }]}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.textPrimary }}>+{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {isEditing && stockNum !== (product?.currentStock ?? 0) ? (
                    <Text style={styles.stockDeltaNote}>
                      Recorded as a stock correction of{' '}
                      {stockNum - (product?.currentStock ?? 0) > 0 ? '+' : ''}
                      {stockNum - (product?.currentStock ?? 0)}.
                    </Text>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.saveBtn, { opacity: isSaving ? 0.6 : 1 }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Product'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingWrapper>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 11.5, marginTop: 2 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stockInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickStockChip: { paddingHorizontal: 11, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  stockDeltaNote: { fontSize: 11, color: '#F59E0B', fontWeight: '700', marginTop: 8 },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: BRAND_COLORS.blue600,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 },
});
