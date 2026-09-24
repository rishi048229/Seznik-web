import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import {
  LayoutDashboard,
  ShoppingBag,
  Calculator,
  Package,
  LayoutGrid,
  PlusCircle,
  ChefHat,
  Receipt,
  Utensils,
} from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/store/useLanguageStore';
import { isKotFirstNav } from '@/utils/businessFeatures';

interface AppBottomNavBarProps {
  activeTab?: 'dashboard' | 'tables' | 'pos' | 'new_bill' | 'calculator' | 'kot' | 'menu' | 'products' | 'sales' | 'more';
  onMorePress?: () => void;
}

export function AppBottomNavBar({ activeTab }: AppBottomNavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();

  const kotFirst = isKotFirstNav(user?.businessType);
  const canAccessKot = hasPermission('canAccessKOT');
  const restaurantPrimary = kotFirst && canAccessKot;
  const bottomInset = Math.max(insets.bottom, 6);

  // Auto-detect active tab from route if not explicitly passed
  const currentTab = activeTab || (
    pathname === '/' || pathname === '/(tabs)'
      ? 'dashboard'
      : pathname.includes('/kot/tables')
      ? 'tables'
      : pathname.includes('/kot/new')
      ? 'new_bill'
      : pathname === '/kot' || pathname.startsWith('/kot/')
      ? 'kot'
      : pathname.includes('/products')
      ? (restaurantPrimary ? 'menu' : 'products')
      : pathname.includes('/pos')
      ? 'pos'
      : pathname.includes('/invoices') || pathname.includes('/sales')
      ? 'sales'
      : undefined
  );

  const tabs = restaurantPrimary
    ? [
        {
          id: 'dashboard',
          label: t('dashboard', 'Dashboard'),
          icon: LayoutDashboard,
          onPress: () => router.push('/(tabs)'),
        },
        {
          id: 'tables',
          label: t('restaurantTables', 'Tables'),
          icon: LayoutGrid,
          onPress: () => router.push('/kot/tables' as any),
        },
        {
          id: 'new_bill',
          label: t('newBill', 'New Bill'),
          icon: PlusCircle,
          onPress: () => router.push('/kot/new' as any),
          highlight: true,
        },
        {
          id: 'kot',
          label: t('kotBoard', 'KOT Board'),
          icon: ChefHat,
          onPress: () => router.push('/kot' as any),
        },
        {
          id: 'menu',
          label: t('menu', 'Menu'),
          icon: Utensils,
          onPress: () => router.push('/products' as any),
        },
      ]
    : [
        {
          id: 'dashboard',
          label: t('dashboard', 'Dashboard'),
          icon: LayoutDashboard,
          onPress: () => router.push('/(tabs)'),
        },
        {
          id: 'pos',
          label: t('pos', 'POS'),
          icon: ShoppingBag,
          onPress: () => router.push('/(tabs)/pos'),
        },
        {
          id: 'calculator',
          label: t('calculator', 'Calculator'),
          icon: Calculator,
          onPress: () => router.push('/(tabs)/calculator'),
        },
        {
          id: 'products',
          label: t('products', 'Products'),
          icon: Package,
          onPress: () => router.push('/products' as any),
        },
        {
          id: 'sales',
          label: t('sales', 'Sales'),
          icon: Receipt,
          onPress: () => router.push('/(tabs)/invoices'),
        },
      ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? '#000000' : '#FFFFFF',
          borderTopColor: theme.isDark ? '#1F1F1F' : BRAND_COLORS.slate200,
          paddingBottom: bottomInset,
        },
      ]}
    >
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          const activeColor = theme.isDark ? BRAND_COLORS.sky400 : BRAND_COLORS.blue600;
          const inactiveColor = theme.isDark ? BRAND_COLORS.slate400 : '#64748B';

          return (
            <TouchableOpacity
              key={tab.id}
              onPress={tab.onPress}
              style={styles.tabBtn}
              activeOpacity={0.7}
            >
              {tab.highlight ? (
                <View
                  style={[
                    styles.highlightIconWrap,
                    {
                      backgroundColor: isActive ? BRAND_COLORS.blue600 : (theme.isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(37, 99, 235, 0.1)'),
                    },
                  ]}
                >
                  <Icon
                    size={20}
                    color={isActive ? '#FFFFFF' : activeColor}
                    strokeWidth={2.4}
                  />
                </View>
              ) : (
                <Icon
                  size={20}
                  color={isActive ? activeColor : inactiveColor}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
              )}
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? activeColor : inactiveColor,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 50,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 3,
    textAlign: 'center',
  },
  highlightIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
