import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';
import { useTranslation } from '@/store/useLanguageStore';
import type { RevenueTrendData } from '@/api/reports';

type TrendPeriod = 'month' | 'daily' | 'monthly';

interface RevenueTrendChartProps {
  timeframe: TrendPeriod;
  onTimeframeChange: (period: TrendPeriod) => void;
  trend: RevenueTrendData;
  isLoading: boolean;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  borderColor: string;
  surfaceBg: string;
}

const PERIOD_OPTIONS: { id: TrendPeriod; labelKey: string; fallback: string }[] = [
  { id: 'month', labelKey: 'trendThisMonth', fallback: 'This Month' },
  { id: 'daily', labelKey: 'trend7Days', fallback: '7 Days' },
  { id: 'monthly', labelKey: 'trend3Months', fallback: '3 Months' },
];

const BAR_MAX_HEIGHT = 112;
const BAR_MIN_HEIGHT = 4;
const BAR_WIDTH = 46;
const BAR_GAP = 6;

function formatFullCurrency(val: number): string {
  return `₹${Math.round(val || 0).toLocaleString('en-IN')}`;
}

/** Readable on-bar label — full ₹ for typical shop-day amounts, compact only when large. */
function formatBarLabel(val: number): string {
  const n = Math.max(0, val || 0);
  if (n === 0) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 10000) return `₹${(n / 1000).toFixed(1)}k`;
  return formatFullCurrency(n);
}

function ChangeBadge({
  changePct,
  textSecondary,
  vsLabel,
}: {
  changePct: number | null;
  textSecondary: string;
  vsLabel: string;
}) {
  const icon =
    changePct === null || changePct === 0 ? (
      <Minus size={12} color={textSecondary} />
    ) : changePct > 0 ? (
      <TrendingUp size={12} color="#10B981" />
    ) : (
      <TrendingDown size={12} color="#EF4444" />
    );

  const color =
    changePct === null || changePct === 0 ? textSecondary : changePct > 0 ? '#10B981' : '#EF4444';

  return (
    <View style={styles.changeBlock}>
      {icon}
      <Text style={[styles.changeText, { color }]}>
        {changePct === null
          ? vsLabel
          : `${changePct > 0 ? '+' : ''}${changePct}% ${vsLabel}`}
      </Text>
    </View>
  );
}

interface BarChartProps {
  labels: string[];
  values: number[];
  selectedIdx: number;
  lastIdx: number;
  onSelect: (idx: number) => void;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}

function BarChart({ labels, values, selectedIdx, lastIdx, onSelect, textPrimary, textSecondary, borderColor }: BarChartProps) {
  const max = Math.max(1, ...values);
  const bestIdx = values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
  const scrollable = values.length > 8;

  const showValueLabel = (idx: number, val: number) => {
    if (idx === selectedIdx || idx === lastIdx || idx === bestIdx) return true;
    if (values.length <= 10) return val > 0;
    return false;
  };

  const bars = values.map((val, idx) => {
    const isToday = idx === lastIdx;
    const isSelected = idx === selectedIdx;
    const isBest = idx === bestIdx && val > 0;
    const barHeight = val > 0 ? Math.max(BAR_MIN_HEIGHT, (val / max) * BAR_MAX_HEIGHT) : BAR_MIN_HEIGHT;
    const active = isSelected;

    return (
      <TouchableOpacity
        key={`bar-${idx}`}
        activeOpacity={0.85}
        onPress={() => onSelect(idx)}
        style={[
          styles.barCol,
          scrollable
            ? { width: BAR_WIDTH, marginRight: BAR_GAP }
            : { flex: 1, marginHorizontal: 2, maxWidth: 56 },
        ]}
      >
        <Text
          style={[
            styles.barValueLabel,
            {
              color: active ? BRAND_COLORS.blue600 : val > 0 ? textPrimary : textSecondary,
              fontWeight: active || isToday ? '900' : '700',
              opacity: showValueLabel(idx, val) ? 1 : 0,
            },
          ]}
          numberOfLines={1}
        >
          {formatBarLabel(val)}
        </Text>

        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                height: barHeight,
                backgroundColor: active
                  ? BRAND_COLORS.blue600
                  : isToday
                    ? BRAND_COLORS.sky500
                    : val > 0
                      ? 'rgba(37, 99, 235, 0.35)'
                      : 'rgba(148, 163, 184, 0.25)',
              },
            ]}
          />
        </View>

        <Text
          style={[
            styles.barXLabel,
            {
              color: active || isToday ? BRAND_COLORS.blue600 : textSecondary,
              fontWeight: active || isToday ? '900' : '700',
            },
          ]}
          numberOfLines={1}
        >
          {labels[idx]}
        </Text>

        {isBest && val > 0 ? (
          <View style={[styles.bestDot, { backgroundColor: '#10B981' }]} />
        ) : null}
      </TouchableOpacity>
    );
  });

  const chartBody = (
    <View style={[styles.barChartInner, scrollable && { paddingHorizontal: 4 }]}>
      {bars}
    </View>
  );

  return (
    <View style={[styles.barChartBox, { borderColor }]}>
      {scrollable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barScrollContent}
        >
          {chartBody}
        </ScrollView>
      ) : (
        <View style={styles.barChartFit}>{chartBody}</View>
      )}
    </View>
  );
}

export function RevenueTrendChart({
  timeframe,
  onTimeframeChange,
  trend,
  isLoading,
  textPrimary,
  textSecondary,
  cardBg,
  borderColor,
  surfaceBg,
}: RevenueTrendChartProps) {
  const { t } = useTranslation();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const revenue = trend.revenue || [];
  const labels = trend.labels || [];
  const hasData = revenue.some((v) => v > 0);

  const stats = useMemo(() => {
    const total = revenue.reduce((s, v) => s + v, 0);
    const lastIdx = Math.max(0, revenue.length - 1);
    const prevIdx = lastIdx - 1;
    const lastVal = revenue[lastIdx] ?? 0;
    const prevVal = prevIdx >= 0 ? revenue[prevIdx] ?? 0 : 0;
    let changePct: number | null = null;
    if (prevVal > 0) {
      changePct = Math.round(((lastVal - prevVal) / prevVal) * 100);
    } else if (lastVal > 0) {
      changePct = 100;
    }

    const bestIdx = revenue.length
      ? revenue.reduce((best, v, i) => (v > revenue[best] ? i : best), 0)
      : 0;
    const bestVal = revenue[bestIdx] ?? 0;
    const bestLabel = labels[bestIdx] || '';

    return {
      total,
      lastIdx,
      lastVal,
      lastLabel: labels[lastIdx] || '',
      changePct,
      bestIdx,
      bestVal,
      bestLabel,
      isLatestToday: (labels[lastIdx] || '').toLowerCase() === 'today',
    };
  }, [revenue, labels]);

  const highlightIdx = selectedIdx ?? stats.lastIdx;
  const highlightVal = revenue[highlightIdx] ?? 0;
  const highlightLabel = labels[highlightIdx] || '—';

  const periodTitle =
    timeframe === 'month'
      ? t('trendThisMonthTitle', 'Revenue this month')
      : timeframe === 'daily'
        ? t('trend7DaysTitle', 'Revenue last 7 days')
        : t('trend3MonthsTitle', 'Revenue last 3 months');

  const vsPreviousLabel =
    timeframe === 'monthly'
      ? t('trendVsPreviousMonth', 'vs last month')
      : t('trendVsPrevious', 'vs previous');

  const heroTitle = stats.isLatestToday
    ? t('todayRevenue', "Today's Revenue")
    : timeframe === 'monthly'
      ? t('trendLatestMonth', 'Latest Month')
      : t('trendLatest', 'Latest');

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>{t('revenueTrend', 'Revenue Trend')}</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>{periodTitle}</Text>
        </View>
      </View>

      <View style={[styles.periodRow, { backgroundColor: surfaceBg, borderColor }]}>
        {PERIOD_OPTIONS.map((opt) => {
          const active = timeframe === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => {
                setSelectedIdx(null);
                onTimeframeChange(opt.id);
              }}
              style={[styles.periodChip, active && styles.periodChipActive]}
            >
              <Text style={[styles.periodChipText, { color: active ? '#FFFFFF' : textSecondary }]}>
                {t(opt.labelKey, opt.fallback)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
        </View>
      ) : !hasData ? (
        <View style={styles.loadingBox}>
          <Text style={[styles.emptyText, { color: textSecondary }]}>
            {t('trendNoSales', 'No sales in this period yet. Bills from POS will appear here.')}
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.heroBlock, { backgroundColor: surfaceBg, borderColor }]}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroKicker, { color: textSecondary }]}>{heroTitle}</Text>
                <Text style={[styles.heroValue, { color: textPrimary }]}>{formatFullCurrency(stats.lastVal)}</Text>
              </View>
              <ChangeBadge
                changePct={stats.changePct}
                textSecondary={textSecondary}
                vsLabel={vsPreviousLabel}
              />
            </View>
            <View style={styles.heroMetaRow}>
              <Text style={[styles.heroMeta, { color: textSecondary }]}>
                {t('trendTotal', 'Period total')}:{' '}
                <Text style={{ color: textPrimary, fontWeight: '800' }}>{formatFullCurrency(stats.total)}</Text>
              </Text>
              {stats.bestVal > 0 ? (
                <Text style={[styles.heroMeta, { color: textSecondary }]}>
                  {t('trendBestDay', 'Best')}:{' '}
                  <Text style={{ color: '#10B981', fontWeight: '800' }}>
                    {stats.bestLabel} · {formatBarLabel(stats.bestVal)}
                  </Text>
                </Text>
              ) : null}
            </View>
          </View>

          <BarChart
            labels={labels}
            values={revenue}
            selectedIdx={highlightIdx}
            lastIdx={stats.lastIdx}
            onSelect={setSelectedIdx}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />

          <View style={[styles.tooltip, { backgroundColor: surfaceBg, borderColor }]}>
            <Text style={[styles.tooltipValue, { color: textPrimary }]}>{formatFullCurrency(highlightVal)}</Text>
            <Text style={[styles.tooltipLabel, { color: textSecondary }]}>
              {highlightLabel}
              {highlightIdx === stats.lastIdx ? ` · ${t('trendLatest', 'Latest')}` : ''}
              {highlightIdx === stats.bestIdx && stats.bestVal > 0 ? ` · ${t('trendPeak', 'Peak')}` : ''}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '900' },
  subtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  periodRow: { flexDirection: 'row', padding: 3, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  periodChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  periodChipActive: { backgroundColor: BRAND_COLORS.blue600 },
  periodChipText: { fontSize: 11, fontWeight: '800' },
  loadingBox: { height: 160, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 12, textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 },
  heroBlock: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: { fontSize: 26, fontWeight: '900', marginTop: 4 },
  heroMetaRow: { marginTop: 10, gap: 4 },
  heroMeta: { fontSize: 11, fontWeight: '600' },
  changeBlock: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '46%' },
  changeText: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  barChartBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
    minHeight: BAR_MAX_HEIGHT + 56,
  },
  barChartFit: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  barScrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  barChartInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
  },
  barCol: {
    alignItems: 'center',
  },
  barValueLabel: {
    fontSize: 9,
    marginBottom: 4,
    minHeight: 12,
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: 22,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: BAR_MIN_HEIGHT,
  },
  barXLabel: {
    fontSize: 9,
    marginTop: 6,
    textAlign: 'center',
  },
  bestDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
  },
  tooltip: { borderRadius: 10, padding: 10, borderWidth: 1, alignItems: 'center' },
  tooltipValue: { fontSize: 18, fontWeight: '900' },
  tooltipLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
