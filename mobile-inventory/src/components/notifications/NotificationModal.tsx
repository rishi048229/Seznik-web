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
  Sliders,
  Sparkles,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import {
  useNotificationStore,
  AppNotification,
} from '@/store/useNotificationStore';
import { useProducts } from '@/hooks/useProducts';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'all' | 'unread' | 'low_stock';

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
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    sendTestNotification,
  } = useNotificationStore();

  const { adjustStock, refetch: refetchProducts } = useProducts();

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'unread') return !notif.read;
    if (activeTab === 'low_stock')
      return notif.type === 'low_stock' || notif.type === 'out_of_stock' || notif.type === 'critical_stock';
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
    } catch (_e) {
      return '';
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
    if (notif.severity === 'critical' || notif.type === 'out_of_stock') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
          <AlertOctagon size={20} color="#EF4444" />
        </View>
      );
    }
    if (notif.severity === 'urgent' || notif.type === 'critical_stock') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <AlertTriangle size={20} color="#F59E0B" />
        </View>
      );
    }
    if (notif.type === 'low_stock') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
          <Package size={20} color="#F97316" />
        </View>
      );
    }
    return (
      <View style={[styles.iconBox, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
        <Bell size={20} color="#2563EB" />
      </View>
    );
  };

  const renderNotificationItem = ({ item }: { item: AppNotification }) => {
    const isOut = item.currentStock !== undefined && item.currentStock <= 0;
    const hasProduct = !!item.productId;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (!item.read) markAsRead(item.id);
        }}
        style={[
          styles.notifCard,
          {
            backgroundColor: item.read
              ? theme.cardBg
              : theme.isDark
              ? 'rgba(37, 99, 235, 0.08)'
              : '#F0F7FF',
            borderColor: !item.read
              ? '#2563EB'
              : theme.borderColor,
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

        {/* Stock Status Pill */}
        {item.currentStock !== undefined && (
          <View style={styles.stockDetailsRow}>
            <View
              style={[
                styles.stockPill,
                {
                  backgroundColor: isOut
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(245, 158, 11, 0.12)',
                  borderColor: isOut ? '#EF4444' : '#F59E0B',
                },
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  { color: isOut ? '#EF4444' : '#D97706' },
                ]}
              >
                {isOut
                  ? `0 ${item.unit || 'units'} Left`
                  : `${item.currentStock} ${item.unit || 'units'} Left (Min: ${item.lowStockThreshold || 5})`}
              </Text>
            </View>

            {hasProduct && (
              <TouchableOpacity
                onPress={() => {
                  setRestockQtyModal({
                    visible: true,
                    productId: item.productId!,
                    productName: item.productName || 'Product',
                    unit: item.unit || 'units',
                    qty: '10',
                    notificationId: item.id,
                  });
                }}
                style={styles.restockBtn}
              >
                <PlusCircle size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.restockBtnText}>Restock Now</Text>
              </TouchableOpacity>
            )}
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
              <Bell size={20} color="#2563EB" />
              {unreadCount > 0 && <View style={styles.headerBadge} />}
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                Notifications
              </Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                {unreadCount > 0
                  ? `${unreadCount} unread stock & store alerts`
                  : 'All notifications caught up'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                router.push('/settings' as any);
              }}
              style={[styles.headerActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginRight: 8 }]}
              accessibilityLabel="Notification Settings"
            >
              <Sliders size={16} color={theme.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.headerActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              accessibilityLabel="Close"
            >
              <X size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Filters & Quick Actions */}
        <View style={styles.tabsRow}>
          <View style={[styles.tabsWrap, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('all')}
              style={[
                styles.tabItem,
                activeTab === 'all' && styles.tabItemActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'all' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                All ({notifications.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('unread')}
              style={[
                styles.tabItem,
                activeTab === 'unread' && styles.tabItemActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'unread' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                Unread ({unreadCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('low_stock')}
              style={[
                styles.tabItem,
                activeTab === 'low_stock' && styles.tabItemActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'low_stock' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                Low Stock 🚨
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Controls Bar */}
        {notifications.length > 0 && (
          <View style={styles.controlsBar}>
            {unreadCount > 0 ? (
              <TouchableOpacity onPress={markAllAsRead} style={styles.controlLink}>
                <CheckCheck size={14} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={styles.controlLinkText}>Mark all as read</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <TouchableOpacity onPress={clearAllNotifications} style={styles.controlLink}>
              <Trash2 size={14} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={[styles.controlLinkText, { color: '#EF4444' }]}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notifications List */}
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconBox,
                  { backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.12)' : '#EFF6FF' },
                ]}
              >
                <Sparkles size={36} color="#2563EB" />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                {activeTab === 'unread'
                  ? 'No Unread Notifications'
                  : activeTab === 'low_stock'
                  ? 'All Stock Levels Healthy 🎉'
                  : 'No Notifications Yet'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {activeTab === 'low_stock'
                  ? 'None of your catalog items are currently below their reorder threshold.'
                  : 'You will receive immediate alerts whenever products drop low in stock.'}
              </Text>

              {notifications.length === 0 && (
                <TouchableOpacity
                  onPress={sendTestNotification}
                  style={styles.testAlertBtn}
                >
                  <Bell size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.testAlertBtnText}>Send Test Stock Alert</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />

        {/* Quick Restock Input Modal */}
        <Modal
          visible={restockQtyModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setRestockQtyModal((p) => ({ ...p, visible: false }))}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Quick Restock Product
              </Text>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                Add inventory to &quot;{restockQtyModal.productName}&quot;
              </Text>

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                Restock Units ({restockQtyModal.unit})
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: theme.borderColor,
                    color: theme.textPrimary,
                  },
                ]}
                keyboardType="numeric"
                value={restockQtyModal.qty}
                onChangeText={(text) =>
                  setRestockQtyModal((prev) => ({ ...prev, qty: text }))
                }
                placeholder="Enter units (e.g. 10)"
                placeholderTextColor="#94A3B8"
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setRestockQtyModal((p) => ({ ...p, visible: false }))}
                  style={[
                    styles.modalBtn,
                    { backgroundColor: theme.isDark ? '#1E293B' : '#F1F5F9' },
                  ]}
                  disabled={isRestocking}
                >
                  <Text style={[styles.modalBtnText, { color: theme.textPrimary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleQuickRestockSubmit}
                  style={[styles.modalBtn, { backgroundColor: '#2563EB' }]}
                  disabled={isRestocking}
                >
                  {isRestocking ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>
                      Confirm Restock
                    </Text>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIconWrap: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  tabsWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  controlLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  controlLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  notifCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 14,
    flex: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#2563EB',
    marginLeft: 6,
  },
  notifTime: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 4,
  },
  stockDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  stockPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  restockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  restockBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  testAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 20,
  },
  testAlertBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
