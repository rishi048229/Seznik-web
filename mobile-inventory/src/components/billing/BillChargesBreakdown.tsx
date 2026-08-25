import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AppliedBillCharge } from '@/constants/restaurantBilling';

interface BillChargesBreakdownProps {
  charges: AppliedBillCharge[];
  theme: {
    textPrimary: string;
    textSecondary: string;
  };
}

export function BillChargesBreakdown({ charges, theme }: BillChargesBreakdownProps) {
  if (!charges.length) return null;

  return (
    <View>
      {charges.map((charge) => (
        <View key={charge.presetId} style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{charge.label}</Text>
          <Text style={[styles.value, { color: '#7C3AED' }]}>+₹{charge.amount.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  label: { fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  value: { fontSize: 12, fontWeight: '800' },
});
