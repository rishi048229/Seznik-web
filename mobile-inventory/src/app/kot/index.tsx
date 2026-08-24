import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChefHat,
  Plus,
  LayoutGrid,
  Search,
  Clock,
  Flame,
  CheckCircle2,
  ChevronRight,
  Utensils,
  ShoppingBag,
  Truck,
  Printer,
  ChevronLeft,
} from 'lucide-react-native';
import { useKotOrders } from '@/hooks/useKotOrders';
import { KOTOrder, KOTOrderStatus, KOTOrderType } from '@/types/kot';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BRAND_COLORS } from '@/constants/theme';
import { useLanguageStore } from '@/store/useLanguageStore';
import { ListScreenSkeleton, KotOrdersListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import ThermalPrinterService from '@/services/PrinterService';

export default function KotOrdersScreen() {
  const router = useRouter();
  const { t } = useLanguageStore();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  const [selectedType, setSelectedType] = useState<KOTOrderType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const activeStatuses: KOTOrderStatus[] =
    selectedStatus === 'active'
      ? ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served']
      : selectedStatus === 'all'
      ? []
      : [selectedStatus as KOTOrderStatus];

  const { orders, isLoading, isRefetching, isError, refetch } = useKotOrders(
    activeStatuses.length > 0 ? activeStatuses : undefined
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesType = selectedType === 'all' || order.orderType === selectedType;
    const matchesSearch =
      searchQuery.trim().length === 0 ||
      `#${order.orderNumber}`.includes(searchQuery) ||
      (order.table?.name && order.table.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.partyLabel && order.partyLabel.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.customer?.name && order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getStatusBadge = (status: KOTOrderStatus) => {
    switch (status) {
      case 'open':
        return { label: 'OPEN', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' };
      case 'sent_to_kitchen':
        return { label: 'IN KITCHEN', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' };
      case 'preparing':
        return { label: 'PREPARING', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'ready':
        return { label: 'READY TO SERVE', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'served':
        return { label: 'SERVED / UNBILLED', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' };
      case 'billed':
        return { label: 'BILLED', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)' };
      case 'cancelled':
        return { label: 'CANCELLED', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
      default:
        return { label: String(status).toUpperCase(), color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' };
    }
  };

  const getTypeIcon = (type: KOTOrderType) => {
    switch (type) {
      case 'dine_in':
        return <Utensils size={13} color={BRAND_COLORS.blue600} />;
      case 'takeaway':
        return <ShoppingBag size={13} color="#F59E0B" />;
      case 'delivery':
        return <Truck size={13} color="#10B981" />;
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
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ChevronLeft size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerBadge}>RESTAURANT KITCHEN</Text>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>KOT Orders Board</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.push('/kot/tables' as any)}
                style={[styles.actionTopBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <LayoutGrid size={16} color={BRAND_COLORS.blue600} />
                <Text style={[styles.actionTopBtnText, { color: theme.textPrimary }]}>Tables</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/kot/new' as any)}
                style={[styles.newOrderBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.newOrderBtnText}>New KOT</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search table, party, #order..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
            />
          </View>

          {/* Order Type Tabs */}
          <View style={styles.tabRow}>
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'dine_in', label: 'Dine-In' },
              { id: 'takeaway', label: 'Takeaway' },
              { id: 'delivery', label: 'Delivery' },
            ].map((tab) => {
              const active = selectedType === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setSelectedType(tab.id as any)}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: active ? BRAND_COLORS.navyInk : theme.cardBg,
                      borderColor: active ? BRAND_COLORS.navyInk : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.tabChipText, { color: active ? '#FFF' : theme.textSecondary }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Status Filter Chips */}
          <View style={[styles.filterRow, { marginBottom: 12 }]}>
            {[
              { id: 'active', label: 'Active Live Orders' },
              { id: 'ready', label: 'Ready to Serve' },
              { id: 'served', label: 'Served' },
              { id: 'all', label: 'History' },
            ].map((st) => {
              const active = selectedStatus === st.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => setSelectedStatus(st.id)}
                  style={[
                    styles.statusFilterChip,
                    {
                      backgroundColor: active ? BRAND_COLORS.blue600 : 'transparent',
                      borderColor: active ? BRAND_COLORS.blue600 : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.statusFilterText, { color: active ? '#FFF' : theme.textSecondary }]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Orders List */}
          {isLoading ? (
            <ScreenLoadingState
              message="Loading kitchen orders..."
              hint="Fetching active KOT tickets and order status"
              skeleton={<KotOrdersListSkeleton count={4} />}
            />
          ) : isError ? (
            <ScreenErrorState
              message="Could not load kitchen orders"
              hint="Check your connection and try again"
              onRetry={refetch}
              isRetrying={isRefetching}
            />
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => {
                const badge = getStatusBadge(item.status);
                const orderTitle =
                  item.orderType === 'dine_in'
                    ? item.table?.name || item.partyLabel || 'Dine-In Table'
                    : item.partyLabel || `${item.orderType.toUpperCase()}`;

                return (
                  <TouchableOpacity
                    onPress={() => router.push(`/kot/${item.id}` as any)}
                    style={[styles.orderCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={styles.orderCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.orderNumBadge}>
                          <Text style={styles.orderNumText}>#{item.orderNumber}</Text>
                        </View>
                        <View style={{ marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.orderTitle, { color: theme.textPrimary }]}>{orderTitle}</Text>
                            {item.priority === 'urgent' && (
                              <View style={styles.urgentBadge}>
                                <Flame size={12} color="#EF4444" />
                                <Text style={styles.urgentText}>URGENT</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            {getTypeIcon(item.orderType)}
                            <Text style={[styles.orderMeta, { color: theme.textSecondary, marginLeft: 4 }]}>
                              {item.orderType.replace('_', ' ').toUpperCase()} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    </View>

                    {/* Items List Preview */}
                    <View style={[styles.itemsPreviewBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                      {item.items.slice(0, 3).map((it, idx) => (
                        <View key={it.id || idx} style={styles.itemRow}>
                          <Text style={[styles.itemNameText, { color: theme.textPrimary }]} numberOfLines={1}>
                            <Text style={{ fontWeight: '800', color: BRAND_COLORS.blue600 }}>{it.quantity}x </Text>
                            {it.productName}
                          </Text>
                          <Text style={[styles.itemPriceText, { color: theme.textSecondary }]}>
                            {formatCurrency(it.unitPrice * it.quantity)}
                          </Text>
                        </View>
                      ))}
                      {item.items.length > 3 && (
                        <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2, fontStyle: 'italic' }}>
                          +{item.items.length - 3} more items...
                        </Text>
                      )}
                    </View>

                    {/* Footer */}
                    <View style={styles.orderFooter}>
                      <View>
                        <Text style={{ fontSize: 10, color: theme.textSecondary }}>Order Total</Text>
                        <Text style={[styles.totalAmountText, { color: BRAND_COLORS.blue600 }]}>
                          {formatCurrency(item.grandTotal || 0)}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: BRAND_COLORS.sky500 }}>
                          View & Settle
                        </Text>
                        <ChevronRight size={16} color={BRAND_COLORS.sky500} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <ChefHat size={44} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No KOT Orders Found</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Tap &quot;+ New KOT&quot; to fire a new kitchen order ticket.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 9, fontWeight: '900', color: BRAND_COLORS.sky500, letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  actionTopBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 4 },
  actionTopBtnText: { fontSize: 12, fontWeight: '800' },
  newOrderBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
  newOrderBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 8 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tabChip: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  tabChipText: { fontSize: 11, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 6 },
  statusFilterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusFilterText: { fontSize: 11, fontWeight: '700' },
  orderCard: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNumBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: BRAND_COLORS.navyInk, alignItems: 'center', justifyContent: 'center' },
  orderNumText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  orderTitle: { fontSize: 15, fontWeight: '900' },
  orderMeta: { fontSize: 11 },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  urgentText: { fontSize: 9, fontWeight: '900', color: '#EF4444', marginLeft: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  itemsPreviewBox: { borderRadius: 12, padding: 10, borderWidth: 1, marginVertical: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  itemNameText: { fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  itemPriceText: { fontSize: 12, fontWeight: '800' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 },
  totalAmountText: { fontSize: 16, fontWeight: '900' },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 10 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
});
