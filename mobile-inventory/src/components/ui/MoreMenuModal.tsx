import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  Users,
  Truck,
  ShoppingBag,
  DollarSign,
  BookOpen,
  BarChart3,
  Settings,
  ShieldCheck,
  Package,
  Ticket,
  UserCog,
  MessageSquarePlus,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/hooks/useAppTheme';
import { FeatureGridTile } from '@/components/ui/FeatureGridTile';

interface MoreMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

const MORE_MENU_ITEMS = [
  {
    id: 'products',
    title: 'Products & Inventory',
    icon: Package,
    color: '#0284C7',
    route: '/products',
  },
  {
    id: 'quick-tokens',
    title: 'Quick Ticket Tokens',
    icon: Ticket,
    color: '#2563EB',
    route: '/quick-tokens',
  },
  {
    id: 'customers',
    title: 'Customers & Ledger',
    icon: Users,
    color: '#059669',
    route: '/customers',
  },
  {
    id: 'suppliers',
    title: 'Suppliers Directory',
    icon: Truck,
    color: '#7C3AED',
    route: '/suppliers',
  },
  {
    id: 'purchases',
    title: 'Stock Purchases',
    icon: ShoppingBag,
    color: '#D97706',
    route: '/purchases',
  },
  {
    id: 'expenses',
    title: 'Expense Tracker',
    icon: DollarSign,
    color: '#DC2626',
    route: '/expenses',
  },
  {
    id: 'credits',
    title: 'Daybook & Cashflow',
    icon: BookOpen,
    color: '#0284C7',
    route: '/credits',
  },
  {
    id: 'reports',
    title: 'Financial Reports',
    icon: BarChart3,
    color: '#2563EB',
    route: '/reports',
  },
  {
    id: 'staff',
    title: 'Staff & Permissions',
    icon: UserCog,
    color: '#7C3AED',
    route: '/staff',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    color: '#64748B',
    route: '/settings',
  },
  {
    id: 'feedback',
    title: 'Send Feedback',
    icon: MessageSquarePlus,
    color: '#0284C7',
    route: '/feedback',
  },
];

export function MoreMenuModal({ visible, onClose }: MoreMenuModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useAppTheme();

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.popoverCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.borderColor,
                },
              ]}
            >
              {/* Grabber Indicator */}
              <View style={styles.grabber} />

              {/* Card Header */}
              <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.avatarMini}>
                    <ShieldCheck size={18} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>More Features</Text>
                    <Text style={[styles.userSub, { color: theme.textSecondary }]}>
                      {user?.displayName || 'Store Account'} · Role: {user?.role || 'Admin'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: theme.borderColor }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Items Grid rendered consecutively without categories */}
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.gridRow}>
                  {MORE_MENU_ITEMS.map((item) => (
                    <FeatureGridTile
                      key={item.id}
                      label={item.title}
                      icon={item.icon}
                      color={item.color}
                      onPress={() => handleNavigate(item.route)}
                      theme={theme}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    paddingBottom: 72, // Positions the popup card right above the bottom navbar
    paddingHorizontal: 12,
  },
  popoverCard: {
    maxHeight: SCREEN_HEIGHT * 0.72,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 10,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  userSub: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: SCREEN_HEIGHT * 0.58,
  },
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
