import React, { useState, useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme, Text } from 'react-native';
import { LayoutDashboard, ShoppingBag, Calculator, Package, Menu } from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';
import { MoreMenuModal } from '@/components/ui/MoreMenuModal';
import { GlobalPosCartBar } from '@/components/pos/GlobalPosCartBar';
import { useTranslation } from '@/store/useLanguageStore';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { t } = useTranslation();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: false,
      freezeOnBlur: true,
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
        fontWeight: '600' as const,
      },
    }),
    [isDark]
  );

  const closeMoreMenu = () => setIsMoreOpen(false);
  const openMoreMenu = () => setIsMoreOpen(true);

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
          listeners={{ tabPress: closeMoreMenu }}
          options={{
            title: t('pos', 'POS'),
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
                {t('pos', 'POS')}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calculator"
          listeners={{ tabPress: closeMoreMenu }}
          options={{
            title: t('calculator', 'Calculator'),
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
                {t('calculator', 'Calculator')}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => <Calculator size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="products"
          listeners={{ tabPress: closeMoreMenu }}
          options={{
            title: t('products', 'Products'),
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
                {t('products', 'Products')}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
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
            title: t('more', 'More'),
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
