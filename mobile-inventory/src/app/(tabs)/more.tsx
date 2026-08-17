import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import {
  Menu,
  Users,
  Truck,
  ShoppingBag,
  DollarSign,
  BookOpen,
  BarChart3,
  Settings,
  ChevronRight,
  ShieldCheck,
  Package,
  Ticket,
  UserCog,
  MessageSquarePlus,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SidebarDrawer } from '@/components/ui/SidebarDrawer';

export default function MoreTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const theme = useAppTheme();

  const menuSections = [
    {
      title: 'Catalog & Counter',
      items: [
        {
          id: 'products',
          title: 'Products & Inventory',
          subtitle: 'Barcode scanning, stock history & category CRUD',
          icon: Package,
          color: '#0284C7',
          bg: 'rgba(2, 132, 199, 0.15)',
          route: '/products',
        },
        {
          id: 'quick-tokens',
          title: 'Quick Ticket Tokens',
          subtitle: 'Single-item counter tickets with daily counter',
          icon: Ticket,
          color: '#2563EB',
          bg: 'rgba(37, 99, 235, 0.15)',
          route: '/quick-tokens',
        },
      ],
    },
    {
      title: 'Management & Ledger',
      items: [
        {
          id: 'customers',
          title: 'Customers & Credit Ledger',
          subtitle: 'Credit limits, balance tracking & WhatsApp reminders',
          icon: Users,
          color: '#059669',
          bg: 'rgba(5, 150, 105, 0.15)',
          route: '/customers',
        },
        {
          id: 'suppliers',
          title: 'Suppliers Directory',
          subtitle: 'Vendor list & GSTIN directory',
          icon: Truck,
          color: '#7C3AED',
          bg: 'rgba(124, 58, 237, 0.15)',
          route: '/suppliers',
        },
        {
          id: 'purchases',
          title: 'Stock Purchases',
          subtitle: 'Record supplier purchases & update stock',
          icon: ShoppingBag,
          color: '#D97706',
          bg: 'rgba(217, 119, 6, 0.15)',
          route: '/purchases',
        },
        {
          id: 'expenses',
          title: 'Expense Tracker',
          subtitle: 'Categorized expenses & receipt camera attachments',
          icon: DollarSign,
          color: '#DC2626',
          bg: 'rgba(220, 38, 38, 0.15)',
          route: '/expenses',
        },
        {
          id: 'credits',
          title: 'Daybook & Cashflow',
          subtitle: 'Money in vs Money out daily ledger',
          icon: BookOpen,
          color: '#0284C7',
          bg: 'rgba(2, 132, 199, 0.15)',
          route: '/credits',
        },
      ],
    },
    {
      title: 'Analytics & Settings',
      items: [
        {
          id: 'reports',
          title: 'Financial Reports',
          subtitle: 'P&L bars, daily sales trend, GST tax output',
          icon: BarChart3,
          color: '#2563EB',
          bg: 'rgba(37, 99, 235, 0.15)',
          route: '/reports',
        },
        {
          id: 'staff',
          title: 'Staff & Permissions',
          subtitle: 'Add cashiers/agents with granular access control',
          icon: UserCog,
          color: '#7C3AED',
          bg: 'rgba(124, 58, 237, 0.15)',
          route: '/staff',
        },
        {
          id: 'settings',
          title: 'Settings',
          subtitle: 'Business profile, printer, receipt & UPI config',
          icon: Settings,
          color: '#64748B',
          bg: 'rgba(100, 116, 139, 0.15)',
          route: '/settings',
        },
        {
          id: 'feedback',
          title: 'Send Feedback',
          subtitle: 'Report a bug or suggest a feature to the team',
          icon: MessageSquarePlus,
          color: '#0284C7',
          bg: 'rgba(2, 132, 199, 0.15)',
          route: '/feedback',
        },
      ],
    },
  ];

  return (
    <ScreenBackground color={theme.bg}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => setIsDrawerOpen(true)}
          style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
        >
          <Menu size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>More Features</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.avatarBox}>
            <ShieldCheck size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: theme.textPrimary }]}>
              {user?.displayName || 'Store Account'}
            </Text>
            <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Role: {user?.role || 'Admin'}</Text>
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, idx) => (
          <View key={idx} style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={[styles.menuCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(item.route as any)}
                    style={[styles.menuItemRow, { borderBottomColor: theme.borderColor }]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                      <Icon size={20} color={item.color} />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.menuItemTitle, { color: theme.textPrimary }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.menuItemSub, { color: theme.textSecondary }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#94A3B8" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Sidebar Drawer */}
      <SidebarDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  menuBtn: { padding: 9, borderRadius: 12, borderWidth: 1, marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  userCard: { borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  userName: { fontSize: 16, fontWeight: '800' },
  userEmail: { fontSize: 12, marginTop: 1 },
  roleBadge: { marginTop: 6, backgroundColor: 'rgba(2, 132, 199, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  roleBadgeText: { color: '#0284C7', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  menuCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuItemRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuItemTitle: { fontSize: 14, fontWeight: '800' },
  menuItemSub: { fontSize: 11, marginTop: 2 },
});
