import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Printer, Calendar, Wallet, CreditCard, Banknote, FileText } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useBillStore } from '@/store/useBillStore';
import { Card } from '@/components/ui/card';

export default function ShiftSummaryScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { bills, loadBills } = useBillStore();

  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadBills();
  }, []);

  // Filter bills for selected date
  const todayBills = bills.filter(b => b.createdAt.startsWith(dateStr));

  // Compute stats
  const totalSales = todayBills.reduce((sum, b) => sum + b.total, 0);
  const totalBills = todayBills.length;
  
  const paymentBreakdown = {
    cash: 0,
    upi: 0,
    card: 0,
    other: 0,
  };

  todayBills.forEach(b => {
    const method = b.paymentMethod || 'cash';
    if (method === 'cash') paymentBreakdown.cash += b.total;
    else if (method === 'upi') paymentBreakdown.upi += b.total;
    else if (method === 'card') paymentBreakdown.card += b.total;
    else paymentBreakdown.other += b.total;
  });

  const getDisplayDate = () => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Shift Summary</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Printer size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.dateSelector}>
          <Calendar size={18} color={colors.textSecondary} />
          <Text style={[styles.dateText, { color: colors.text }]}>{getDisplayDate()}</Text>
        </View>

        <View style={styles.mainMetrics}>
          <Card style={styles.metricCard}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Total Collection</Text>
            <Text style={[styles.metricValue, { color: colors.success }]}>₹{totalSales.toFixed(2)}</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Bills Generated</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>{totalBills}</Text>
          </Card>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Breakdown</Text>
        <Card style={styles.breakdownCard}>
          <View style={[styles.breakdownRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.success + '20' }]}>
                <Banknote size={16} color={colors.success} />
              </View>
              <Text style={[styles.breakdownLabel, { color: colors.text }]}>Cash</Text>
            </View>
            <Text style={[styles.breakdownAmount, { color: colors.text }]}>₹{paymentBreakdown.cash.toFixed(2)}</Text>
          </View>
          
          <View style={[styles.breakdownRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#8B5CF620' }]}>
                <Wallet size={16} color="#8B5CF6" />
              </View>
              <Text style={[styles.breakdownLabel, { color: colors.text }]}>UPI / Digital</Text>
            </View>
            <Text style={[styles.breakdownAmount, { color: colors.text }]}>₹{paymentBreakdown.upi.toFixed(2)}</Text>
          </View>
          
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
                <CreditCard size={16} color={colors.primary} />
              </View>
              <Text style={[styles.breakdownLabel, { color: colors.text }]}>Card / Other</Text>
            </View>
            <Text style={[styles.breakdownAmount, { color: colors.text }]}>
              ₹{(paymentBreakdown.card + paymentBreakdown.other).toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Placeholder for expenses - Phase 12 if we do it */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Shift Notes & Expenses</Text>
        <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
          <FileText size={32} color={colors.neutral} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No expenses logged for this shift.</Text>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16, gap: 16 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  dateText: { fontSize: 16, fontWeight: '600' },
  mainMetrics: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, padding: 20, alignItems: 'center', gap: 8 },
  metricLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  metricValue: { fontSize: 24, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  breakdownCard: { paddingHorizontal: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { fontSize: 15, fontWeight: '600' },
  breakdownAmount: { fontSize: 16, fontWeight: '700' },
  emptyCard: { padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, borderStyle: 'dashed', borderWidth: 1 },
  emptyText: { fontSize: 14, fontWeight: '500' },
});
