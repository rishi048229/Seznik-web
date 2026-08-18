import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { LayoutDashboard, ShoppingBag, Calculator, Package, Menu } from 'lucide-react-native';
import { useCartStore } from '@/store/useCartStore';
import { BRAND_COLORS } from '@/constants/theme';
import { MoreMenuModal } from '@/components/ui/MoreMenuModal';

import { useLanguageStore } from '@/store/useLanguageStore';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { t } = useLanguageStore();
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: isDark ? BRAND_COLORS.sky400 : BRAND_COLORS.sky500,
          tabBarInactiveTintColor: isDark ? BRAND_COLORS.slate400 : '#64748B',
          tabBarStyle: {
            backgroundColor: isDark ? BRAND_COLORS.slate900 : '#FFFFFF',
            borderTopColor: isDark ? BRAND_COLORS.slate800 : BRAND_COLORS.slate200,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('dashboard', 'Dashboard'),
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="pos"
          options={{
            title: t('pos', 'POS'),
            tabBarBadge: cartItemsCount > 0 ? cartItemsCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: BRAND_COLORS.blue600,
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 'bold',
            },
            tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calculator"
          options={{
            title: t('calculator', 'Calculator'),
            tabBarIcon: ({ color, size }) => <Calculator size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: t('products', 'Products'),
            tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
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
            title: t('more', 'More'),
            tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setIsMoreOpen(true);
            },
          }}
        />
      </Tabs>

      {/* Floating Popover Card for More Actions */}
      <MoreMenuModal visible={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
}
