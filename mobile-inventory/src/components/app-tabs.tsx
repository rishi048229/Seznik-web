import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Home, Receipt, Package, Settings, Zap, Users } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useShopStore } from '@/store/useShopStore';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { mode } = useShopStore();

  const isFixed = mode === 'fixed';
  const isProduct = mode === 'product';
  const isHybrid = mode === 'hybrid';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      }}
    >
      {/* 1. HOME (All Modes) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={20} />,
        }}
      />

      {/* 2. BILLING TAB (Universal Hub) */}
      <Tabs.Screen
        name="billing/index"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color }) => <Receipt color={color} size={20} />,
        }}
      />

      {/* 3. MANAGEMENT TAB (Customers vs Inventory) */}
      <Tabs.Screen
        name="customers/index"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color }) => <Users color={color} size={20} />,
          href: isFixed ? '/customers' : null,
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <Package color={color} size={20} />,
          href: (isProduct || isHybrid) ? '/products' as any : null,
        }}
      />

      {/* 4. SETTINGS (All Modes) */}
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings color={color} size={20} />,
        }}
      />

      {/* HIDE ALL SUB-PAGES FROM BOTTOM TAB BAR */}
      <Tabs.Screen name="billing/new" options={{ href: null }} />
      <Tabs.Screen name="inventory/[id]" options={{ href: null }} />
      <Tabs.Screen name="inventory/add-edit" options={{ href: null }} />
      <Tabs.Screen name="inventory/scanner" options={{ href: null }} />
      <Tabs.Screen name="inventory/bulk-upload" options={{ href: null }} />
      <Tabs.Screen name="vendors/index" options={{ href: null }} />
      <Tabs.Screen name="vendors/[id]" options={{ href: null }} />
      <Tabs.Screen name="vendors/add-edit" options={{ href: null }} />
      <Tabs.Screen name="billing/[id]" options={{ href: null }} />
      <Tabs.Screen name="quick-bill/manage-tiles" options={{ href: null }} />
      <Tabs.Screen name="customers/[id]" options={{ href: null }} />
      <Tabs.Screen name="customers/add-edit" options={{ href: null }} />
      <Tabs.Screen name="onboarding/index" options={{ href: null }} />
      <Tabs.Screen name="onboarding/mode-select" options={{ href: null }} />
      <Tabs.Screen name="onboarding/store-setup" options={{ href: null }} />
    </Tabs>
  );
}
