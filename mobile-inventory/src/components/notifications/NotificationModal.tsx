import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  X,
  Bell,
  AlertOctagon,
  AlertTriangle,
  Package,
  CheckCheck,
  Trash2,
  PlusCircle,
  ExternalLink,
  CreditCard,
  TrendingUp,
  Megaphone,
  ArrowRight,
  RefreshCw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import {
  useNotificationStore,
  AppNotification,
} from '@/store/useNotificationStore';
import { useProducts } from '@/hooks/useProducts';
import { BRAND_COLORS } from '@/constants/theme';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'all' | 'stock' | 'credit' | 'sales' | 'announcements';

export function NotificationModal({ visible, onClose }: NotificationModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [restockQtyModal, setRestockQtyModal] = useState<{
    visible: boolean;
    productId: string;
    productName: string;
    unit: string;
    qty: string;
    notificationId?: string;
  }>({
    visible: false,
    productId: '',
    productName: '',
    unit: 'units',
    qty: '10',
  });
  const [isRestocking, setIsRestocking] = useState(false);

  const {
    notifications,
    unreadCount,
    isSyncingFeed,
    syncLiveFeed,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotificationStore();

  const { adjustStock, refetch: refetchProducts } = useProducts();

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'stock') {
      return notif.type === 'low_stock' || notif.type === 'out_of_stock' || notif.type === 'critical_stock';
    }
    if (activeTab === 'credit') {
      return notif.type === 'credit_due' || notif.type === 'payment_due';
    }
    if (activeTab === 'sales') {
      return notif.type === 'daily_sales_summary';
    }
    if (activeTab === 'announcements') {
      return notif.type === 'announcement' || notif.type === 'system';
    }
    return true;
  });

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const handleNotificationCardPress = (item: AppNotification) => {
    if (!item.read) markAsRead(item.id);

    // Deep navigation based on notification type
    if (item.type === 'low_stock' || item.type === 'out_of_stock' || item.type === 'critical_stock') {
      onClose();
      router.push('/products' as any);
    } else if (item.type === 'credit_due' || item.type === 'payment_due') {
      onClose();
      router.push('/staff' as any);
    } else if (item.type === 'daily_sales_summary') {
      onClose();
      router.push('/reports' as any);
    } else if (item.type === 'announcement' || item.type === 'system') {
      onClose();
      router.push('/settings' as any);
    }
  };

  const handleQuickRestockSubmit = async () => {
    const qty = parseInt(restockQtyModal.qty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid restock quantity greater than 0.');
      return;
    }

    setIsRestocking(true);
    try {
      if (restockQtyModal.productId && restockQtyModal.productId !== 'test-product-id') {
        await adjustStock({
          id: restockQtyModal.productId,
          payload: { change: qty, reason: 'Quick Restock from Low Stock Notification' },
        });
        await refetchProducts();
      }

      if (restockQtyModal.notificationId) {
        await markAsRead(restockQtyModal.notificationId);
      }

      setRestockQtyModal((prev) => ({ ...prev, visible: false }));
      Alert.alert(
        'Stock Updated! 📦',
        `Successfully added +${qty} ${restockQtyModal.unit} to "${restockQtyModal.productName}".`
      );
    } catch (err: any) {
      Alert.alert('Restock Failed', err?.message || 'Failed to update stock.');
    } finally {
      setIsRestocking(false);
    }
  };

  const renderNotificationIcon = (notif: AppNotification) => {
    if (notif.type === 'out_of_stock' || notif.severity === 'critical') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
          <AlertOctagon size={20} color="#EF4444" />
        </View>
      );
    }
    if (notif.type === 'low_stock' || notif.type === 'critical_stock') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Package size={20} color="#F59E0B" />
        </View>
      );
    }
    if (notif.type === 'credit_due' || notif.type === 'payment_due') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
          <CreditCard size={20} color="#8B5CF6" />
        </View>
      );
    }
    if (notif.type === 'daily_sales_summary') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
          <TrendingUp size={20} color="#10B981" />
        </View>
      );
    }
    return (
      <View style={[styles.iconBox, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
        <Megaphone size={20} color="#2563EB" />
      </View>
    );
  };

  const renderNotificationItem = ({ item }: { item: AppNotification }) => {
    const isOut = item.currentStock !== undefined && item.currentStock <= 0;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleNotificationCardPress(item)}
        style={[
          styles.notifCard,
          {
            backgroundColor: item.read
              ? theme.cardBg
              : theme.isDark
              ? 'rgba(37, 99, 235, 0.08)'
              : '#F0F7FF',
            borderColor: !item.read ? BRAND_COLORS.blue600 : theme.borderColor,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          {renderNotificationIcon(item)}

          <View style={{ flex: 1, marginLeft: 10, marginRight: 6 }}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.notifTitle,
                  { color: theme.textPrimary, fontWeight: item.read ? '700' : '900' },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={[styles.notifTime, { color: theme.textSecondary }]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => deleteNotification(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteBtn}
          >
            <Trash2 size={15} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.notifBody, { color: theme.textPrimary }]}>
          {item.message}
        </Text>

        {/* 1. Low Stock & Out of Stock Actions */}
        {item.currentStock !== undefined && (
          <View style={styles.actionFooterRow}>
            <View
              style={[
                styles.pillBadge,
                {
                  backgroundColor: isOut ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  borderColor: isOut ? '#EF4444' : '#F59E0B',
                },
              ]}
            >
              <Text style={[styles.pillBadgeText, { color: isOut ? '#EF4444' : '#D97706' }]}>
                {isOut ? `0 ${item.unit || 'units'} Left` : `${item.currentStock} ${item.unit || 'units'} Left`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setRestockQtyModal({
                  visible: true,
                  productId: item.productId || '',
                  productName: item.productName || 'Product',
                  unit: item.unit || 'units',
                  qty: '10',
                  notificationId: item.id,
                });
              }}
              style={styles.actionBtnPrimary}
            >
              <PlusCircle size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.actionBtnText}>Restock Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. Customer Credit Due Action */}
        {(item.type === 'credit_due' || item.type === 'payment_due') && (
          <View style={styles.actionFooterRow}>
            <View style={[styles.pillBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)', borderColor: '#8B5CF6' }]}>
              <Text style={[styles.pillBadgeText, { color: '#8B5CF6' }]}>
                Pending: ₹{item.amount ? item.amount.toFixed(2) : 'Due'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600, marginRight: 4 }}>
                View Ledger
              </Text>
              <ArrowRight size={13} color={BRAND_COLORS.blue600} />
            </View>
          </View>
        )}

        {/* 3. Daily Sales Summary Action */}
        {item.type === 'daily_sales_summary' && (
          <View style={styles.actionFooterRow}>
            <View style={[styles.pillBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }]}>
              <Text style={[styles.pillBadgeText, { color: '#10B981' }]}>
                Revenue: ₹{item.totalSales !== undefined ? item.totalSales.toFixed(2) : '0.00'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600, marginRight: 4 }}>
                Open Analytics
              </Text>
              <ArrowRight size={13} color={BRAND_COLORS.blue600} />
            </View>
          </View>
        )}

        {/* 4. Announcement Action */}
        {(item.type === 'announcement' || item.type === 'system') && (
          <View style={[styles.actionFooterRow, { justifyContent: 'flex-end' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600, marginRight: 4 }}>
                Review Settings
              </Text>
              <ExternalLink size={13} color={BRAND_COLORS.blue600} />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.bg,
            paddingTop: insets.top || 12,
            paddingBottom: insets.bottom || 12,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.headerIconWrap}>
              <Bell size={20} color={BRAND_COLORS.blue600} />
              {unreadCount > 0 && <View style={styles.headerBadge} />}
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                Notification Box
              </Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                {unreadCount > 0
                  ? `${unreadCount} unread store alert${unreadCount > 1 ? 's' : ''}`
                  : 'All notifications caught up'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={() => markAllAsRead()}
                style={[styles.headerActionBtn, { borderColor: theme.borderColor }]}
              >
                <CheckCheck size={14} color={theme.textPrimary} style={{ marginRight: 4 }} />
                <Text style={[styles.headerActionText, { color: theme.textPrimary }]}>Read All</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <X size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Tabs for the 4 Notification Categories */}
        <View style={[styles.tabsRow, { borderBottomColor: theme.borderColor }]}>
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'stock', label: 'Stock 📦' },
              { key: 'credit', label: 'Credits 💳' },
              { key: 'sales', label: 'Daily Sales 🌙' },
              { key: 'announcements', label: 'Store 📢' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabPill,
                  active && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                  !active && { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                ]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    active ? { color: '#FFFFFF', fontWeight: '800' } : { color: theme.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notifications List */}
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isSyncingFeed}
              onRefresh={() => syncLiveFeed()}
              tintColor={BRAND_COLORS.blue600}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.cardBg }]}>
                <Bell size={32} color={theme.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                No Notifications
              </Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {activeTab === 'stock'
                  ? 'All products are safely stocked above reorder thresholds.'
                  : activeTab === 'credit'
                  ? 'No outstanding customer credit balances.'
                  : activeTab === 'sales'
                  ? 'Daily reports will appear at day-end.'
                  : 'You are all caught up on alerts and store announcements.'}
              </Text>
            </View>
          }
        />

        {/* Footer: Clear All */}
        {notifications.length > 0 && (
          <View style={[styles.footerBar, { borderTopColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Clear Notifications',
                  'Clear all notifications from your box?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear All', style: 'destructive', onPress: () => clearAllNotifications() },
                  ]
                );
              }}
              style={styles.clearAllBtn}
            >
              <Trash2 size={14} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.clearAllText}>Clear All Notifications</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Restock Dialog */}
        <Modal
          visible={restockQtyModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setRestockQtyModal((p) => ({ ...p, visible: false }))}
        >
          <View style={styles.restockOverlay}>
            <View style={[styles.restockCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.restockTitle, { color: theme.textPrimary }]}>
                Quick Restock Product
              </Text>
              <Text style={[styles.restockSub, { color: theme.textSecondary }]}>
                {restockQtyModal.productName}
              </Text>

              <Text style={[styles.restockInputLabel, { color: theme.textPrimary }]}>
                Units to Add (+):
              </Text>
              <TextInput
                style={[styles.restockInput, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                keyboardType="numeric"
                value={restockQtyModal.qty}
                onChangeText={(qty) => setRestockQtyModal((p) => ({ ...p, qty }))}
                placeholder="10"
                placeholderTextColor="#94A3B8"
                autoFocus
              />

              <View style={styles.restockActionsRow}>
                <TouchableOpacity
                  onPress={() => setRestockQtyModal((p) => ({ ...p, visible: false }))}
                  style={[styles.restockCancelBtn, { borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.restockCancelText, { color: theme.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleQuickRestockSubmit}
                  disabled={isRestocking}
                  style={styles.restockSubmitBtn}
                >
                  {isRestocking ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.restockSubmitText}>Apply +{restockQtyModal.qty || 0}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
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
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub: { fontSize: 11, marginTop: 1 },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  headerActionText: { fontSize: 11, fontWeight: '700' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 6,
  },
  tabPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabPillText: { fontSize: 11.5, fontWeight: '700' },
  listContent: { padding: 14, gap: 10 },
  notifCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifTitle: { fontSize: 13.5, flex: 1 },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BRAND_COLORS.blue600,
    marginLeft: 6,
  },
  notifTime: { fontSize: 10, marginTop: 2 },
  deleteBtn: { padding: 4 },
  notifBody: { fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 8 },
  actionFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.1)',
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillBadgeText: { fontSize: 10.5, fontWeight: '800' },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  footerBar: {
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', padding: 6 },
  clearAllText: { color: '#EF4444', fontSize: 12, fontWeight: '800' },
  restockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  restockCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  restockTitle: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  restockSub: { fontSize: 12, marginBottom: 14 },
  restockInputLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  restockInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  restockActionsRow: { flexDirection: 'row', gap: 10 },
  restockCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  restockCancelText: { fontWeight: '800', fontSize: 13 },
  restockSubmitBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  restockSubmitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
});
