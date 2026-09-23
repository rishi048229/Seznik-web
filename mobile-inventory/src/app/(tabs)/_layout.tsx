import React, { useState, useMemo } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useColorScheme, Text } from 'react-native';
import {
  LayoutDashboard,
  ShoppingBag,
  Calculator,
  Package,
  Menu,
  LayoutGrid,
  Plus,
  ChefHat,
} from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreMenuModal } from '@/components/ui/MoreMenuModal';
import { GlobalPosCartBar } from '@/components/pos/GlobalPosCartBar';
import { useTranslation } from '@/store/useLanguageStore';
import { useAuth } from '@/hooks/useAuth';
import { getCatalogNavLabel, isKotFirstNav, isNavFeatureVisible } from '@/utils/businessFeatures';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const router = useRouter();

  const kotFirst = isKotFirstNav(user?.businessType);
  const canAccessKot = hasPermission('canAccessKOT');
  const restaurantPrimary = kotFirst && canAccessKot;
  const catalogLabel = restaurantPrimary
    ? t('kotBoard', 'KOT Board')
    : getCatalogNavLabel(user?.businessType);
  const showCenterTab = restaurantPrimary
    ? true
    : isNavFeatureVisible(user?.businessType, 'calculator');

  const bottomInset = Math.max(insets.bottom, 0);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: true,
      freezeOnBlur: true,
      animation: 'shift' as const,
      sceneStyle: { backgroundColor: isDark ? '#000000' : '#F8FAFC' },
      tabBarActiveTintColor: isDark ? BRAND_COLORS.sky400 : BRAND_COLORS.sky500,
      tabBarInactiveTintColor: isDark ? BRAND_COLORS.slate400 : '#64748B',
      tabBarStyle: {
        backgroundColor: isDark ? '#000000' : '#FFFFFF',
        borderTopColor: isDark ? '#1F1F1F' : BRAND_COLORS.slate200,
        height: 60 + bottomInset,
        paddingBottom: Math.max(bottomInset, 6),
        paddingTop: 6,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600' as const,
      },
    }),
    [isDark, bottomInset]
  );

  const closeMoreMenu = () => setIsMoreOpen(false);
  const openMoreMenu = () => setIsMoreOpen(true);

  const posTitle = restaurantPrimary
    ? t('restaurantTables', 'Tables')
    : t('pos', 'POS');
  const centerTitle = restaurantPrimary
    ? t('newBill', 'New Bill')
    : t('calculator', 'Calculator');

  return (
    <>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          listeners={{ tabPress: closeMoreMenu }}
          options={{
            title: t('dashboard', 'Dashboard'),
            tabBarLabel: ({ color, focused }) => (
              <Text
                style={{
                  color,
                  fontSize: 10.5,
                  fontWeight: focused ? '700' : '500',
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {t('dashboard', 'Dashboard')}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="pos"
          listeners={{
            tabPress: (e) => {
              closeMoreMenu();
              if (restaurantPrimary) {
                e.preventDefault();
                router.push('/kot/tables' as any);
              }
            },
          }}
          options={{
            title: posTitle,
            tabBarLabel: ({ color, focused }) => (
              <Text
                style={{
                  color,
                  fontSize: 10.5,
                  fontWeight: focused ? '700' : '500',
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {posTitle}
              </Text>
            ),
            tabBarIcon: ({ color, size }) =>
              restaurantPrimary ? (
                <LayoutGrid size={size} color={color} />
              ) : (
                <ShoppingBag size={size} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="calculator"
          listeners={{
            tabPress: (e) => {
              closeMoreMenu();
              if (restaurantPrimary) {
                e.preventDefault();
                router.push('/kot/new' as any);
              }
            },
          }}
          options={{
            href: showCenterTab ? undefined : null,
            title: centerTitle,
            tabBarLabel: ({ color, focused }) => (
              <Text
                style={{
                  color,
                  fontSize: 10.5,
                  fontWeight: focused ? '700' : '500',
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {centerTitle}
              </Text>
            ),
            tabBarIcon: ({ color, size }) =>
              restaurantPrimary ? (
                <Plus size={size} color={color} strokeWidth={2.5} />
              ) : (
                <Calculator size={size} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="products"
          listeners={{
            tabPress: (e) => {
              closeMoreMenu();
              if (restaurantPrimary) {
                e.preventDefault();
                router.push('/kot' as any);
              }
            },
          }}
          options={{
            title: catalogLabel,
            tabBarLabel: ({ color, focused }) => (
              <Text
                style={{
                  color,
                  fontSize: 10.5,
                  fontWeight: focused ? '700' : '500',
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {restaurantPrimary
                  ? t('kotBoard', 'KOT Board')
                  : catalogLabel === 'Menu'
                  ? t('menu', 'Menu')
                  : t('products', 'Products')}
              </Text>
            ),
            tabBarIcon: ({ color, size }) =>
              restaurantPrimary ? (
                <ChefHat size={size} color={color} />
              ) : (
                <Package size={size} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="invoices"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="sales"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            href: restaurantPrimary ? null : undefined,
            tabBarLabel: ({ color, focused }) => (
              <Text
                style={{
                  color,
                  fontSize: 10.5,
                  fontWeight: focused ? '700' : '500',
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {t('more', 'More')}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              openMoreMenu();
            },
          }}
        />
      </Tabs>

      {/* Floating Popover Card for More Actions */}
      <MoreMenuModal visible={isMoreOpen} onClose={closeMoreMenu} />
      <GlobalPosCartBar />
    </>
  );
}
