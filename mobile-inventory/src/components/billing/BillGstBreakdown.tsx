import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GstBreakdownStyle } from '@/constants/gstBilling';
import type { GstBillSummary } from '@/utils/gst';
import { formatInr } from '@/utils/gst';

interface BillGstBreakdownProps {
  summary: GstBillSummary;
  style: GstBreakdownStyle;
  theme: {
    textPrimary: string;
    textSecondary: string;
  };
}

export function BillGstBreakdown({ summary, style, theme }: BillGstBreakdownProps) {
  if (summary.totalGst <= 0 && summary.taxableValue <= 0) return null;

  if (style === 'slab_wise') {
    return (
      <View>
        {summary.slabs.map((slab) => (
          <View key={String(slab.gstRate)} style={styles.slabBlock}>
            {slab.gstRate === 0 ? (
              <BreakdownRow
                label="Nil Rated / Exempt"
                value={formatInr(slab.taxableValue)}
                color={theme.textSecondary}
                muted
              />
            ) : (
              <>
                <BreakdownRow
                  label={`Taxable @ ${slab.gstRate}%`}
                  value={formatInr(slab.taxableValue)}
                  color={theme.textSecondary}
                  muted
                />
                <BreakdownRow
                  label={`CGST @ ${slab.cgstRate}%`}
                  value={`+${formatInr(slab.cgstAmount)}`}
                  color="#3B82F6"
                />
                <BreakdownRow
                  label={`SGST @ ${slab.sgstRate}%`}
                  value={`+${formatInr(slab.sgstAmount)}`}
                  color="#3B82F6"
                />
              </>
            )}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      <BreakdownRow label="Taxable Value" value={formatInr(summary.taxableValue)} color={theme.textSecondary} muted />
      <BreakdownRow label="CGST" value={`+${formatInr(summary.cgstAmount)}`} color="#3B82F6" />
      <BreakdownRow label="SGST" value={`+${formatInr(summary.sgstAmount)}`} color="#3B82F6" />
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color, fontWeight: muted ? '600' : '700' }]}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slabBlock: { marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '700' },
});
