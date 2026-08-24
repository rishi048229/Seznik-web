import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';
import { ProductGstBreakdown, formatInr } from '@/utils/gst';

interface GstBreakdownCardProps {
  breakdown: ProductGstBreakdown;
  theme: {
    textPrimary: string;
    textSecondary: string;
    borderColor: string;
    bg: string;
  };
  compact?: boolean;
}

export function GstBreakdownCard({ breakdown, theme, compact = false }: GstBreakdownCardProps) {
  const { taxableValue, cgstRate, sgstRate, cgstAmount, sgstAmount, totalGst, finalPrice, gstRate, priceIncludesGst } =
    breakdown;

  if (breakdown.enteredPrice <= 0) {
    return null;
  }

  const priceBasisLabel = priceIncludesGst ? 'GST Inclusive Price' : 'GST Exclusive Price (Taxable Value)';

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.bg, borderColor: theme.borderColor },
      ]}
    >
      <View style={styles.headerRow}>
        <Receipt size={14} color={BRAND_COLORS.blue600} />
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>GST Breakdown</Text>
      </View>

      <Text style={[styles.basisLabel, { color: theme.textSecondary }]}>
        {priceBasisLabel} · Intra-state (CGST + SGST)
      </Text>

      {gstRate === 0 ? (
        <View style={[styles.exemptBanner, { borderColor: theme.borderColor }]}>
          <Text style={[styles.exemptText, { color: theme.textSecondary }]}>
            Nil Rated / Exempt — No GST applicable on this item
          </Text>
        </View>
      ) : (
        <>
          <BreakdownRow label="Taxable Value" value={formatInr(taxableValue)} theme={theme} />
          <BreakdownRow
            label={`CGST @ ${cgstRate}%`}
            value={formatInr(cgstAmount)}
            theme={theme}
            muted
          />
          <BreakdownRow
            label={`SGST @ ${sgstRate}%`}
            value={formatInr(sgstAmount)}
            theme={theme}
            muted
          />
          <BreakdownRow label="Total GST" value={formatInr(totalGst)} theme={theme} highlight />
        </>
      )}

      <View style={[styles.divider, { backgroundColor: theme.borderColor }]} />

      <BreakdownRow
        label={priceIncludesGst ? 'Final Price (MRP)' : 'Final Price (MRP incl. GST)'}
        value={formatInr(finalPrice)}
        theme={theme}
        bold
      />
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  theme,
  muted,
  highlight,
  bold,
}: {
  label: string;
  value: string;
  theme: { textPrimary: string; textSecondary: string };
  muted?: boolean;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          { color: muted ? theme.textSecondary : theme.textPrimary },
          bold && styles.rowLabelBold,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          { color: highlight ? BRAND_COLORS.blue600 : theme.textPrimary },
          bold && styles.rowValueBold,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  cardCompact: {
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  basisLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 10,
  },
  exemptBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  exemptText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowLabelBold: {
    fontWeight: '800',
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowValueBold: {
    fontSize: 14,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
});
