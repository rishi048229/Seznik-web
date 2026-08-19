import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  LayoutGrid,
  Utensils,
  Trash2,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import { useRestaurantTables } from '@/hooks/useRestaurantTables';
import { RestaurantTable } from '@/types/kot';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BRAND_COLORS } from '@/constants/theme';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

export default function RestaurantTablesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  const { tables, isLoading, isRefetching, refetch, createTable, deleteTable, isCreating } =
    useRestaurantTables();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      Alert.alert('Table Name Required', 'Please enter a name for the table (e.g. Table 1, Rooftop 2).');
      return;
    }
    try {
      await createTable({ name: newTableName.trim() });
      setNewTableName('');
      setShowAddModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create table');
    }
  };

  const handleDeleteTable = (table: RestaurantTable) => {
    Alert.alert('Delete Table', `Are you sure you want to remove "${table.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTable(table.id);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete table');
          }
        },
      },
    ]);
  };

  const handleTablePress = (table: RestaurantTable) => {
    if (table.isOccupied && table.activeOrder) {
      router.push(`/kot/${table.activeOrder.id}` as any);
    } else {
      router.push('/kot/new' as any);
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <ChevronLeft size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerBadge}>RESTAURANT LAYOUT</Text>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Dining Tables</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              style={[styles.addTableBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addTableBtnText}>+ Add Table</Text>
            </TouchableOpacity>
          </View>

          {/* Tables Grid */}
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
            </View>
          ) : (
            <FlatList
              data={tables}
              keyExtractor={(item) => item.id}
              numColumns={2}
              refreshing={isRefetching}
              onRefresh={refetch}
              contentContainerStyle={{ paddingBottom: 30 }}
              columnWrapperStyle={{ gap: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleTablePress(item)}
                  style={[
                    styles.tableCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: item.isOccupied ? '#EF4444' : theme.borderColor,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={[styles.tableIconBox, { backgroundColor: item.isOccupied ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)' }]}>
                      <Utensils size={18} color={item.isOccupied ? '#EF4444' : '#10B981'} />
                    </View>

                    <TouchableOpacity onPress={() => handleDeleteTable(item)} style={{ padding: 4 }}>
                      <Trash2 size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.tableNameText, { color: theme.textPrimary }]}>{item.name}</Text>

                  {item.isOccupied && item.activeOrder ? (
                    <View style={styles.occupiedInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Clock size={11} color="#EF4444" />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444', marginLeft: 3 }}>
                          KOT #{item.activeOrder.orderNumber}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: BRAND_COLORS.blue600, marginTop: 2 }}>
                        {formatCurrency(item.activeOrder.totalAmount)} ({item.activeOrder.itemsCount} items)
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 8 }}>
                      ● Vacant
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <LayoutGrid size={44} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Tables Configured</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Tap &quot;+ Add Table&quot; to configure dining tables for table orders.
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Add Table Modal */}
        <Modal visible={showAddModal} transparent animationType="fade">
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add Dining Table</Text>
                  <TouchableOpacity onPress={() => setShowAddModal(false)}>
                    <X size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Table Name / Identifier</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={newTableName}
                  onChangeText={setNewTableName}
                  placeholder="e.g. Table 1, Table 2, Rooftop 4..."
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />

                <TouchableOpacity
                  onPress={handleCreateTable}
                  disabled={isCreating}
                  style={[styles.saveTableBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveTableBtnText}>Save Table</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  backBtn: { padding: 8, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 9, fontWeight: '900', color: BRAND_COLORS.sky500, letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  addTableBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
  addTableBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  tableCard: { flex: 1, borderRadius: 18, padding: 14, borderWidth: 1.5, marginBottom: 10 },
  tableIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tableNameText: { fontSize: 15, fontWeight: '900', marginTop: 10 },
  occupiedInfo: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(239, 68, 68, 0.2)' },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 10 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 18, borderWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 14 },
  saveTableBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  saveTableBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
});
