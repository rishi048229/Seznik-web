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
import { FeatureGridTile } from '@/components/ui/FeatureGridTile';

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
      ],
    },
    {
      title: 'Management & Ledger',
      items: [
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
      ],
    },
    {
      title: 'Analytics & Settings',
      items: [
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

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

          {/* Menu Sections rendered as Dashboard-style Tile Grid */}
          {menuSections.map((section, idx) => (
            <View key={idx} style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.title}</Text>
              <View style={styles.compactGridRow}>
                {section.items.map((item) => (
                  <FeatureGridTile
                    key={item.id}
                    label={item.title}
                    icon={item.icon}
                    color={item.color}
                    onPress={() => router.push(item.route as any)}
                    theme={theme}
                  />
                ))}
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
  sectionContainer: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  compactGridRow: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4 },
});
