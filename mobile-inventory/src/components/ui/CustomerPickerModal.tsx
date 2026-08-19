import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { X, Search, UserCircle2, Plus, ChevronRight } from 'lucide-react-native';
import { useCustomers } from '@/hooks/useCustomers';
import { useAppTheme } from '@/hooks/useAppTheme';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';

interface CustomerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** id === null means "Walk-in Customer" (no attached account). */
  onSelect: (id: string | null, name: string | null) => void;
}

/**
 * Searchable customer picker used by the POS checkout flow — lets a sale stay a fast anonymous
 * "Walk-in" by default, or get attached to a real customer (required for Credit payments so the
 * balance lands on somebody's account). Reuses the existing useCustomers() hook — no new API.
 */
export function CustomerPickerModal({ visible, onClose, onSelect }: CustomerPickerModalProps) {
  const theme = useAppTheme();
  const { t, currentLanguage } = useTranslation();
  const { customers, isLoading, createCustomer, isCreating } = useCustomers();
  const [query, setQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filtered = customers.filter((c) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  const handleSelectWalkIn = () => {
    onSelect(null, null);
    onClose();
  };

  const handleSelectCustomer = (id: string, name: string) => {
    onSelect(id, name);
    onClose();
  };

  const handleCreateCustomer = async () => {
    if (!newName.trim()) {
      Alert.alert('Name Required', 'Please enter the customer’s name.');
      return;
    }
    try {
      const created = await createCustomer({ name: newName.trim(), phone: newPhone.trim() || undefined });
      setNewName('');
      setNewPhone('');
      setShowAddForm(false);
      onSelect(created.id, created.name);
      onClose();
    } catch (e: any) {
      Alert.alert('Could Not Add Customer', e?.message || 'Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingWrapper inModal>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{t('selectCustomer', 'Select Customer')}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={15} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder={t('searchCustomers', 'Search by name or phone...')}
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <TouchableOpacity
            onPress={handleSelectWalkIn}
            style={[styles.row, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
          >
            <View style={[styles.avatarCircle, { backgroundColor: 'rgba(100, 116, 139, 0.18)' }]}>
              <UserCircle2 size={20} color={theme.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{t('walkInCustomer', 'Walk-in Customer')}</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>No account attached — fastest option</Text>
            </View>
            <ChevronRight size={16} color={theme.textSecondary} />
          </TouchableOpacity>


          {isLoading ? (
            <ActivityIndicator size="small" color={BRAND_COLORS.blue600} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={{ marginTop: 4 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              ListEmptyComponent={
                query.trim() ? (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No customers match "{query}".</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectCustomer(item.id, item.name)}
                  style={[styles.row, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                    <Text style={{ color: BRAND_COLORS.blue600, fontWeight: '800' }}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{item.phone || 'No phone on file'}</Text>
                  </View>
                  {item.creditBalance > 0 ? (
                    <View style={styles.creditBadge}>
                      <Text style={styles.creditBadgeText}>₹{item.creditBalance.toFixed(0)} due</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          )}

          {showAddForm ? (
            <View style={[styles.addForm, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TextInput
                style={[styles.addInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
                placeholder="Customer Name *"
                placeholderTextColor="#94A3B8"
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.addInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor, marginTop: 8 }]}
                placeholder="Phone Number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
              />
              <TouchableOpacity onPress={handleCreateCustomer} disabled={isCreating} style={styles.addSubmitBtn}>
                {isCreating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addSubmitBtnText}>Add & Select Customer</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowAddForm(true)} style={styles.addNewBtn}>
              <Plus size={16} color={BRAND_COLORS.blue600} />
              <Text style={styles.addNewBtnText}>Add New Customer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      </KeyboardAvoidingWrapper>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900' },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 11, marginTop: 1 },
  creditBadge: { backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  creditBadgeText: { fontSize: 10, fontWeight: '800', color: '#B45309' },
  emptyText: { fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  addNewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 4 },
  addNewBtnText: { fontSize: 13, fontWeight: '800', color: BRAND_COLORS.blue600, marginLeft: 6 },
  addForm: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 4 },
  addInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  addSubmitBtn: { backgroundColor: BRAND_COLORS.blue600, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  addSubmitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
