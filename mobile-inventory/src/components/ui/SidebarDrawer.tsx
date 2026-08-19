import React from 'react';
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
  Receipt,
  Users,
  Truck,
  DollarSign,
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
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/store/useLanguageStore';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/constants/translations';
import { BRAND_COLORS } from '@/constants/theme';

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

  const theme = isDark
    ? {
        bg: BRAND_COLORS.slate950,
        cardBg: BRAND_COLORS.slate800,
        borderColor: BRAND_COLORS.slate700,
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        activeBg: 'rgba(37, 99, 235, 0.15)',
        activeText: BRAND_COLORS.sky400,
      }
    : {
        bg: '#FFFFFF',
        cardBg: BRAND_COLORS.slate50,
        borderColor: BRAND_COLORS.slate200,
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        activeBg: 'rgba(37, 99, 235, 0.1)',
        activeText: BRAND_COLORS.blue600,
      };

  const navGroups = [
    {
      title: t('corePosSales', 'CORE POS & SALES'),
      items: [
        { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard, route: '/(tabs)' },
        { id: 'pos', label: t('pos', 'Full POS Checkout'), icon: ShoppingBag, route: '/(tabs)/pos' },
        { id: 'calculator', label: t('calculator', 'POS Calculator'), icon: Calculator, route: '/(tabs)/calculator' },
        { id: 'sales', label: t('salesHistory', 'Sales History & Receipts'), icon: Receipt, route: '/sales' },
        { id: 'tokens', label: t('quickTokens', 'Quick Counter Tokens'), icon: Ticket, route: '/quick-tokens' },
      ],
    },
    ...(hasPermission('canAccessKOT')
      ? [
          {
            title: t('kotRestaurantOrders', 'KOT & RESTAURANT ORDERS'),
            items: [
              { id: 'kot-orders', label: t('ordersBoard', 'Orders Board'), icon: ChefHat, route: '/kot' },
              { id: 'kot-new', label: t('newKotOrder', 'New Order'), icon: PlusCircle, route: '/kot/new' },
              { id: 'kot-tables', label: t('restaurantTables', 'Tables'), icon: LayoutGrid, route: '/kot/tables' },
            ],
          },
        ]
      : []),
    {
      title: t('inventoryCatalog', 'INVENTORY & CATALOG'),
      items: [
        { id: 'products', label: t('products', 'Products & Barcodes'), icon: Package, route: '/products' },
      ],
    },
    {
      title: t('hardwarePrinters', 'HARDWARE & PRINTERS'),
      items: [
        { id: 'printers', label: t('thermalPrinter', 'Printers & Calibration'), icon: Printer, route: '/printers' },
      ],
    },
    {
      title: t('suppliersPurchases', 'SUPPLIERS & PURCHASES'),
      items: [
        { id: 'suppliers', label: t('suppliers', 'Suppliers Directory'), icon: Truck, route: '/suppliers' },
        { id: 'purchases', label: t('purchases', 'Stock Purchases'), icon: ShoppingBag, route: '/purchases' },
      ],
    },
    {
      title: t('customersDaybook', 'CUSTOMERS & DAYBOOK'),
      items: [
        { id: 'customers', label: t('customers', 'Customers & Credit Ledger'), icon: Users, route: '/customers' },
        { id: 'credits', label: t('dayBook', 'Daybook Cashflow'), icon: BookOpen, route: '/credits' },
        { id: 'expenses', label: t('expenses', 'Expense Tracker'), icon: DollarSign, route: '/expenses' },
      ],
    },
    {
      title: t('analyticsSettings', 'ANALYTICS & SETTINGS'),
      items: [
        { id: 'reports', label: t('reports', 'P&L Reports & GST Output'), icon: BarChart3, route: '/reports' },
        { id: 'settings', label: t('settings', 'Settings & Staff Users'), icon: Settings, route: '/settings' },
        { id: 'feedback', label: t('feedback', 'Review & Suggest'), icon: Star, route: '/feedback' },
      ],
    },
  ];

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  return (
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
                    {t('brandTitle', 'Seznik')} <Text style={{ color: BRAND_COLORS.blue600 }}>POS</Text>
                  </Text>
                  <Text style={[styles.brandSub, { color: theme.textSecondary }]}>
                    {t('brandSub', 'Mobile Companion')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 12 }}>
              <View style={[styles.profileTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Text style={[styles.profileName, { color: theme.textPrimary }]}>
                  {user?.displayName || 'Store Admin'}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                  {user?.email || 'admin@seznik.com'}
                </Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{t('role', 'Role')}: {user?.role || 'admin'}</Text>
                </View>
              </View>

              {navGroups.map((group, gIdx) => (
                <View key={gIdx} style={styles.navGroup}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.route;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleNavigate(item.route)}
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
        </View>

        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      </View>
    </Modal>
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
