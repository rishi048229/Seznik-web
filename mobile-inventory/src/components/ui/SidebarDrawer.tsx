import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  LayoutDashboard,
  ShoppingBag,
  Package,
  TrendingUp,
  TrendingDown,
  Users,
  Truck,
  BookOpen,
  BarChart3,
  Settings,
  Ticket,
  Printer,
  Calculator,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Star,
  ChefHat,
  PlusCircle,
  LayoutGrid,
  Zap,
  FileText,
  MessageSquareHeart,
  Sparkles,
  Send,
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/store/useLanguageStore';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/constants/translations';
import { BRAND_COLORS } from '@/constants/theme';
import { NavFeatureId } from '@/constants/businessTypes';
import { getCatalogNavLabel, isKotFirstNav, isNavFeatureVisible } from '@/utils/businessFeatures';
import { AiBillToReceiptModal } from '@/components/printers/AiBillToReceiptModal';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.82, 340);

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function SidebarDrawer({ visible, onClose }: SidebarDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, logout, hasPermission } = useAuth();
  const { currentLanguage, setLanguage, t } = useTranslation();
  const businessType = user?.businessType;
  const kotFirst = isKotFirstNav(businessType);
  const catalogLabel =
    getCatalogNavLabel(businessType) === 'Menu'
      ? t('menu', 'Menu')
      : t('products', 'Products & Barcodes');
  const [showBillConverter, setShowBillConverter] = useState(false);

  const isFeatureVisible = (feature?: NavFeatureId) => {
    if (!feature) return true;
    return isNavFeatureVisible(businessType, feature);
  };

  const corePosItems = (kotFirst
    ? [
        { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard, route: '/(tabs)', perm: null as null | 'canAccessSales' | 'canSendRemotePrint' | 'canAccessProducts' | 'canAccessCustomers' },
        { id: 'print-jobs', label: t('requests', 'Requests'), icon: Send, route: '/print-jobs', perm: null },
        { id: 'sales', label: t('sales', 'Sales'), icon: TrendingUp, route: '/(tabs)/invoices', perm: 'canAccessSales' as const },
        { id: 'pos', label: t('pos', 'Counter POS'), icon: ShoppingBag, route: '/(tabs)/pos', perm: 'canAccessSales' as const },
        ...(isFeatureVisible('calculator')
          ? [{ id: 'calculator', label: t('calculator', 'POS Calculator'), icon: Calculator, route: '/(tabs)/calculator', perm: 'canAccessSales' as const }]
          : []),
        ...(isFeatureVisible('tokens')
          ? [{ id: 'tokens', label: t('quickTokens', 'Quick Counter Tokens'), icon: Ticket, route: '/quick-tokens', perm: 'canAccessSales' as const }]
          : []),
      ]
    : [
        { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard, route: '/(tabs)', perm: null },
        { id: 'print-jobs', label: t('requests', 'Requests'), icon: Send, route: '/print-jobs', perm: null },
        { id: 'pos', label: t('pos', 'Full POS Checkout'), icon: ShoppingBag, route: '/(tabs)/pos', perm: 'canAccessSales' as const },
        ...(isFeatureVisible('calculator')
          ? [{ id: 'calculator', label: t('calculator', 'POS Calculator'), icon: Calculator, route: '/(tabs)/calculator', perm: 'canAccessSales' as const }]
          : []),
        { id: 'sales', label: t('sales', 'Sales'), icon: TrendingUp, route: '/(tabs)/invoices', perm: 'canAccessSales' as const },
        ...(isFeatureVisible('tokens')
          ? [{ id: 'tokens', label: t('quickTokens', 'Quick Counter Tokens'), icon: Ticket, route: '/quick-tokens', perm: 'canAccessSales' as const }]
          : []),
      ]
  ).filter((item) => {
    const agent = user?.accountType === 'managed' || Boolean((user as any)?.adminId);
    if (!agent || !item.perm) return true;
    return hasPermission(item.perm);
  });

  const theme = isDark
    ? {
        bg: '#000000',
        cardBg: '#121212',
        borderColor: '#262626',
        textPrimary: '#FFFFFF',
        textSecondary: '#A1A1AA',
        activeBg: 'rgba(255, 255, 255, 0.08)',
        activeText: '#FFFFFF',
        reviewBg: 'rgba(37, 99, 235, 0.10)',
        reviewBorder: 'rgba(56, 189, 248, 0.22)',
        reviewIconBg: 'rgba(56, 189, 248, 0.15)',
        reviewIconColor: BRAND_COLORS.sky400,
        reviewTitle: '#FFFFFF',
        reviewSub: '#94A3B8',
        reviewArrow: BRAND_COLORS.sky400,
      }
    : {
        bg: '#FFFFFF',
        cardBg: BRAND_COLORS.slate50,
        borderColor: BRAND_COLORS.slate200,
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        activeBg: 'rgba(37, 99, 235, 0.1)',
        activeText: BRAND_COLORS.blue600,
        reviewBg: 'rgba(37, 99, 235, 0.06)',
        reviewBorder: 'rgba(37, 99, 235, 0.18)',
        reviewIconBg: 'rgba(37, 99, 235, 0.12)',
        reviewIconColor: BRAND_COLORS.blue600,
        reviewTitle: '#0F172A',
        reviewSub: '#64748B',
        reviewArrow: BRAND_COLORS.blue600,
      };

  const kotGroup =
    isFeatureVisible('kot') && hasPermission('canAccessKOT')
      ? [
          {
            title: t('kotRestaurantOrders', 'KOT & RESTAURANT ORDERS'),
            items: [
              { id: 'kot-tables', label: t('restaurantTables', 'Tables'), icon: LayoutGrid, route: '/kot/tables' },
              { id: 'kot-new', label: t('newBill', 'New Bill'), icon: PlusCircle, route: '/kot/new' },
              { id: 'kot-orders', label: t('ordersBoard', 'Orders Board'), icon: ChefHat, route: '/kot' },
            ],
          },
        ]
      : [];

  const inventoryItems = [
    ...(hasPermission('canAccessProducts')
      ? [
          {
            id: 'products',
            label: kotFirst ? catalogLabel : t('products', 'Products & Barcodes'),
            icon: Package,
            route: '/products',
          },
        ]
      : []),
  ];

  const supplierItems = [
    ...(isFeatureVisible('suppliers') && hasPermission('canAccessSuppliers')
      ? [{ id: 'suppliers', label: t('suppliers', 'Suppliers Directory'), icon: Truck, route: '/suppliers' }]
      : []),
  ];

  const customerItems = [
    ...( !(user?.accountType === 'managed' || Boolean((user as any)?.adminId)) || hasPermission('canAccessCustomers')
      ? [{ id: 'customers', label: t('customers', 'Customers & Credit Ledger'), icon: Users, route: '/customers' }]
      : []),
    ...( !(user?.accountType === 'managed' || Boolean((user as any)?.adminId)) || hasPermission('canAccessReports') || hasPermission('canAccessSales')
      ? [{ id: 'credits', label: t('dayBook', 'Daybook Cashflow'), icon: BookOpen, route: '/credits' }]
      : []),
    ...(hasPermission('canAccessExpenses')
      ? [{ id: 'expenses', label: t('expenses', 'Expense Tracker'), icon: TrendingDown, route: '/expenses' }]
      : []),
  ];

  const isAgent = user?.accountType === 'managed' || Boolean((user as any)?.adminId);

  const settingsItems = [
    ...(hasPermission('canAccessReports')
      ? [{ id: 'reports', label: t('reports', 'P&L Reports & GST Output'), icon: BarChart3, route: '/reports' }]
      : []),
    ...(!isAgent && (hasPermission('canManageUsers') || user?.role === 'admin' || hasPermission('canAccessSettings'))
      ? [{ id: 'settings', label: t('settings', 'Settings & Staff Users'), icon: Settings, route: '/settings' }]
      : []),
  ];

  const navGroups = kotFirst
    ? [
        {
          title: t('kotRestaurantOrders', 'RESTAURANT'),
          items: [
            { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard, route: '/(tabs)' },
            { id: 'kot-tables', label: t('restaurantTables', 'Tables'), icon: LayoutGrid, route: '/kot/tables' },
            { id: 'kot-new', label: t('newBill', 'New Bill'), icon: PlusCircle, route: '/kot/new' },
            { id: 'kot-orders', label: t('ordersBoard', 'KOT Board'), icon: ChefHat, route: '/kot' },
            ...(hasPermission('canAccessProducts')
              ? [{ id: 'products', label: catalogLabel, icon: Package, route: '/products' }]
              : []),
            // Kitchen Inventory removed from the restaurant profile on request — restaurants
            // manage a menu, not a raw-ingredient stock list. The screen itself still exists at
            // /kitchen-inventory for anyone who navigates there directly.
            ...(!isAgent && (hasPermission('canAccessSettings') || user?.role === 'admin')
              ? [{ id: 'restaurant-settings', label: t('restaurantSettings', 'Restaurant Settings'), icon: ChefHat, route: '/restaurant-settings' }]
              : []),
            ...(hasPermission('canAccessReports')
              ? [{ id: 'reports', label: t('reports', 'Reports & Analytics'), icon: BarChart3, route: '/reports' }]
              : []),
            ...(!isAgent && (hasPermission('canManageUsers') || user?.role === 'admin')
              ? [{ id: 'staff', label: t('staffRoles', 'Staff & Roles'), icon: ShieldCheck, route: '/staff' }]
              : []),
            { id: 'printers', label: t('thermalPrinter', 'Printer & Devices'), icon: Printer, route: '/printers' },
            ...(!isAgent && (hasPermission('canAccessSettings') || user?.role === 'admin' || hasPermission('canManageUsers'))
              ? [{ id: 'settings', label: t('settings', 'Business Settings'), icon: Settings, route: '/settings' }]
              : []),
          ],
        },
      ]
    : [
    ...(kotFirst ? kotGroup : []),
    {
      title: kotFirst
        ? t('corePosSales', 'COUNTER & SALES')
        : t('corePosSales', 'CORE POS & SALES'),
      items: corePosItems,
    },
    ...(!kotFirst ? kotGroup : []),
    ...(inventoryItems.length > 0
      ? [
          {
            title: t('inventoryCatalog', 'INVENTORY & CATALOG'),
            items: inventoryItems,
          },
        ]
      : []),
    {
      title: t('hardwarePrinters', 'HARDWARE & PRINTERS'),
      items: [
        ...(!(user?.accountType === 'managed' || Boolean((user as any)?.adminId)) ||
        hasPermission('canAccessSales') ||
        hasPermission('canAccessKOT')
          ? [
              { id: 'printers', label: t('thermalPrinter', 'Printers & Calibration'), icon: Printer, route: '/printers' },
              { id: 'quick-print', label: t('quickPrint', 'Text to Thermal Print'), icon: FileText, route: '/printers/quick-print' },
            ]
          : []),
        ...(!(user?.accountType === 'managed' || Boolean((user as any)?.adminId)) || hasPermission('canAccessSales')
          ? [{ id: 'bill-converter', label: 'A4 Bill to Receipt (AI)', icon: Zap, route: '/a4-to-receipt' }]
          : []),
      ],
    },
    ...(supplierItems.length > 0
      ? [
          {
            title: t('suppliers', 'SUPPLIERS & VENDORS'),
            items: supplierItems,
          },
        ]
      : []),
    {
      title: t('customersDaybook', 'CUSTOMERS & DAYBOOK'),
      items: customerItems,
    },
    ...(settingsItems.length > 0
      ? [
          {
            title: t('analyticsSettings', 'ANALYTICS & SETTINGS'),
            items: settingsItems,
          },
        ]
      : []),
  ].filter((group) => group.items.length > 0);

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.drawerContent, { width: DRAWER_WIDTH, backgroundColor: theme.bg }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.drawerHeader, { borderBottomColor: theme.borderColor }]}>
              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <ShieldCheck size={22} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>
                    {t('brandTitle', 'Seznik')}{' '}
                    <Text style={{ color: BRAND_COLORS.blue600 }}>
                      {kotFirst ? t('kitchenTables', 'Kitchen') : 'POS'}
                    </Text>
                  </Text>
                  <Text style={[styles.brandSub, { color: theme.textSecondary }]}>
                    {kotFirst
                      ? t('brandSubRestaurant', 'Tables & settle bill')
                      : t('brandSub', 'Mobile Companion')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 12 }}>
              <View style={[styles.profileTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.profileName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {user?.displayName || (isAgent ? 'Staff Agent' : 'Store Admin')}
                    </Text>
                    <Text style={[styles.profileEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                      {user?.email || 'user@seznik.com'}
                    </Text>
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: isAgent ? 'rgba(245, 158, 11, 0.15)' : 'rgba(37, 99, 235, 0.15)' }]}>
                    <Text style={[styles.rolePillText, { color: isAgent ? '#D97706' : BRAND_COLORS.blue600 }]}>
                      {isAgent ? 'AGENT' : 'ADMIN'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleNavigate('/(auth)/access-selection')}
                  style={[styles.switchRoleBtn, { borderColor: theme.borderColor, backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}
                  activeOpacity={0.7}
                >
                  <Sparkles size={13} color={BRAND_COLORS.blue600} />
                  <Text style={styles.switchRoleText}>Switch Workstation / Role</Text>
                  <ChevronRight size={13} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {navGroups.map((group, gIdx) => (
                <View key={gIdx} style={styles.navGroup}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = 'route' in item && pathname === item.route;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                          if ('onPress' in item && typeof (item as any).onPress === 'function') {
                            (item as any).onPress();
                          } else if ('route' in item && item.route) {
                            handleNavigate(item.route);
                          }
                        }}
                        style={[
                          styles.navItem,
                          isActive && { backgroundColor: theme.activeBg },
                        ]}
                      >
                        <Icon
                          size={18}
                          color={isActive ? theme.activeText : theme.textSecondary}
                        />
                        <Text
                          style={[
                            styles.navLabel,
                            { color: isActive ? theme.activeText : theme.textPrimary },
                            isActive && { fontWeight: '800' },
                          ]}
                        >
                          {item.label}
                        </Text>
                        <ChevronRight
                          size={14}
                          color={isActive ? theme.activeText : theme.borderColor}
                          style={{ marginLeft: 'auto' }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={styles.navGroup}>
                <Text style={styles.groupTitle}>{t('appLanguage', 'APP LANGUAGE')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginTop: 4 }}>
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = currentLanguage === lang.code;
                    return (
                      <TouchableOpacity
                        key={lang.code}
                        onPress={() => setLanguage(lang.code)}
                        style={[
                          styles.langChip,
                          {
                            backgroundColor: isSelected ? BRAND_COLORS.blue600 : theme.cardBg,
                            borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.langChipText,
                            { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                          ]}
                        >
                          {lang.nativeName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={[styles.drawerFooter, { borderTopColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={() => handleNavigate('/feedback')}
                style={[
                  styles.reviewBanner,
                  {
                    backgroundColor: theme.reviewBg,
                    borderColor: theme.reviewBorder,
                  },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('reviewBannerTitle', 'Reviews & Suggestions')}
              >
                <View style={[styles.reviewBannerIcon, { backgroundColor: theme.reviewIconBg }]}>
                  <MessageSquareHeart size={18} color={theme.reviewIconColor} />
                </View>
                <View style={styles.reviewBannerCopy}>
                  <Text style={[styles.reviewBannerTitle, { color: theme.reviewTitle }]} numberOfLines={1}>
                    {t('reviewBannerTitle', 'Reviews & Suggestions')}
                  </Text>
                  <Text style={[styles.reviewBannerSub, { color: theme.reviewSub }]} numberOfLines={1}>
                    {t('reviewBannerSub', 'Rate the app or send an idea')}
                  </Text>
                </View>
                <ChevronRight size={16} color={theme.reviewArrow} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  logout();
                }}
                style={styles.logoutBtn}
              >
                <LogOut size={18} color="#EF4444" />
                <Text style={styles.logoutBtnText}>{t('logout', 'Log Out Account')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <AiBillToReceiptModal
            visible={showBillConverter}
            onClose={() => setShowBillConverter(false)}
          />
        </View>

        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
  },
  drawerContent: {
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.navyInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  profileTile: {
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  rolePill: {
    marginTop: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  rolePillText: {
    color: BRAND_COLORS.blue600,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  switchRoleBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  switchRoleText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_COLORS.blue600,
  },
  navGroup: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  reviewBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reviewBannerCopy: {
    flex: 1,
    marginRight: 6,
  },
  reviewBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  reviewBannerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 8,
  },
});
