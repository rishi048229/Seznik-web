import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
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
  IndianRupee,
  Ticket,
  MessageSquarePlus,
  ChefHat,
  LayoutGrid,
  Calculator,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/hooks/useAppTheme';
import { FeatureGridTile } from '@/components/ui/FeatureGridTile';

import { useTranslation } from '@/store/useLanguageStore';
import { NavFeatureId } from '@/constants/businessTypes';
import { isKotFirstNav, isNavFeatureVisible } from '@/utils/businessFeatures';

interface MoreMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MoreMenuModal({ visible, onClose }: MoreMenuModalProps) {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const kotFirst = isKotFirstNav(user?.businessType);

  const menuItems: Array<{
    id: string;
    title: string;
    icon: typeof IndianRupee;
    color: string;
    route: string;
    feature?: NavFeatureId;
  }> = [
    {
      id: 'invoices',
      title: t('invoices', 'Invoices'),
      icon: IndianRupee,
      color: '#0284C7',
      route: '/(tabs)/invoices',
    },
    // When Tables / New Bill are primary tabs, demote POS + Calculator here
    ...(kotFirst
      ? [
          {
            id: 'pos',
            title: t('pos', 'Counter POS'),
            icon: ShoppingBag,
            color: '#0EA5E9',
            route: '/(tabs)/pos',
          },
          {
            id: 'calculator',
            title: t('calculator', 'Calculator'),
            icon: Calculator,
            color: '#6366F1',
            route: '/(tabs)/calculator',
            feature: 'calculator' as NavFeatureId,
          },
        ]
      : []),
    {
      id: 'kot-orders',
      title: t('kotOrders', 'KOT Orders'),
      icon: ChefHat,
      color: '#F97316',
      route: '/kot',
      feature: 'kot',
    },
    // Tables stay in More only when not already a primary tab
    ...(!kotFirst
      ? [
          {
            id: 'kot-tables',
            title: t('restaurantTables', 'Tables'),
            icon: LayoutGrid,
            color: '#7C3AED',
            route: '/kot/tables',
            feature: 'kot' as NavFeatureId,
          },
        ]
      : []),
    {
      id: 'quick-tokens',
      title: t('quickTokens', 'Quick Counter Tokens'),
      icon: Ticket,
      color: '#2563EB',
      route: '/quick-tokens',
      feature: 'tokens',
    },
    {
      id: 'customers',
      title: t('customers', 'Customers & Ledger'),
      icon: Users,
      color: '#059669',
      route: '/customers',
    },
    {
      id: 'suppliers',
      title: t('suppliers', 'Suppliers Directory'),
      icon: Truck,
      color: '#7C3AED',
      route: '/suppliers',
      feature: 'suppliers',
    },

    {
      id: 'expenses',
      title: t('expenses', 'Expense Tracker'),
      icon: DollarSign,
      color: '#DC2626',
      route: '/expenses',
    },
    {
      id: 'credits',
      title: t('dayBook', 'Daybook & Cashflow'),
      icon: BookOpen,
      color: '#0284C7',
      route: '/credits',
    },
    {
      id: 'reports',
      title: t('reports', 'Financial Reports'),
      icon: BarChart3,
      color: '#2563EB',
      route: '/reports',
    },
    {
      id: 'settings',
      title: t('settings', 'Settings'),
      icon: Settings,
      color: '#64748B',
      route: '/settings',
    },
    {
      id: 'feedback',
      title: t('feedback', 'Send Feedback'),
      icon: MessageSquarePlus,
      color: '#0284C7',
      route: '/feedback',
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.feature && !isNavFeatureVisible(user?.businessType, item.feature)) return false;
    if (item.feature === 'kot' && !hasPermission('canAccessKOT')) return false;
    return true;
  });

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
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
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
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('more', 'More Features')}</Text>
                <Text style={[styles.userSub, { color: theme.textSecondary }]}>
                  {user?.displayName || 'Store Account'} · {t('role', 'Role')}: {user?.role || 'Admin'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Grid Content */}
          <ScrollView
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.gridRow}>
              {visibleMenuItems.map((item) => (
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
      </View>
    </Modal>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    paddingBottom: 72,
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
    zIndex: 1,
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
