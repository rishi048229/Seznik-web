import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
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

const CHART_HEIGHT = 180;

function formatCompactCurrency(val: number): string {
  const n = Math.max(0, val || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function formatFullCurrency(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

function buildLinePath(
  values: number[],
  width: number,
  height: number,
  pad: { t: number; r: number; b: number; l: number }
): { linePath: string; areaPath: string; points: { x: number; y: number; v: number; idx: number }[]; max: number } {
  const max = Math.max(1, ...values);
  const chartW = width - pad.l - pad.r;
  const chartH = height - pad.t - pad.b;
  const count = values.length;

  const points = values.map((v, idx) => ({
    x: pad.l + (count <= 1 ? chartW / 2 : (idx / (count - 1)) * chartW),
    y: pad.t + chartH - (v / max) * chartH,
    v,
    idx,
  }));

  if (points.length === 0) {
    return { linePath: '', areaPath: '', points: [], max };
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const baseY = pad.t + chartH;
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseY} L ${points[0].x.toFixed(1)} ${baseY} Z`;

  return { linePath, areaPath, points, max };
}

function yTicks(max: number): number[] {
  if (max <= 0) return [0];
  const step = max <= 1000 ? Math.ceil(max / 4 / 100) * 100 || 100 : Math.ceil(max / 4 / 1000) * 1000;
  const ticks: number[] = [0];
  for (let v = step; v < max; v += step) ticks.push(v);
  ticks.push(max);
  return ticks;
}

interface LineGraphProps {
  labels: string[];
  values: number[];
  width: number;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  textSecondary: string;
}

function LineGraph({ labels, values, width, selectedIdx, onSelect, textSecondary }: LineGraphProps) {
  const pad = { t: 12, r: 8, b: 26, l: 42 };
  const { linePath, areaPath, points, max } = buildLinePath(values, width, CHART_HEIGHT, pad);
  const ticks = yTicks(max);
  const chartH = CHART_HEIGHT - pad.t - pad.b;

  const xLabelIndices = useMemo(() => {
    if (labels.length <= 7) return labels.map((_, i) => i);
    const step = Math.max(1, Math.floor(labels.length / 5));
    const indices: number[] = [];
    for (let i = 0; i < labels.length; i += step) indices.push(i);
    if (indices[indices.length - 1] !== labels.length - 1) indices.push(labels.length - 1);
    return indices;
  }, [labels.length]);

  if (width <= 0 || points.length === 0) return null;

  return (
    <View style={{ width, height: CHART_HEIGHT, position: 'relative' }}>
      <Svg width={width} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={BRAND_COLORS.sky500} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={BRAND_COLORS.sky500} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {ticks.map((tick) => {
          const y = pad.t + chartH - (tick / max) * chartH;
          return (
            <React.Fragment key={tick}>
              <Line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="rgba(148,163,184,0.25)" strokeWidth={1} />
              <SvgText x={pad.l - 6} y={y + 4} fontSize={9} fontWeight="600" fill={textSecondary} textAnchor="end">
                {formatCompactCurrency(tick)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {areaPath ? <Path d={areaPath} fill="url(#areaFill)" /> : null}
        {linePath ? (
          <Path d={linePath} fill="none" stroke={BRAND_COLORS.sky500} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}

        {points.map((p) => {
          const active = p.idx === selectedIdx;
          return (
            <Circle
              key={p.idx}
              cx={p.x}
              cy={p.y}
              r={active ? 5 : 3}
              fill={active ? BRAND_COLORS.sky500 : '#FFFFFF'}
              stroke={BRAND_COLORS.sky500}
              strokeWidth={active ? 2 : 1.5}
            />
          );
        })}

        {xLabelIndices.map((idx) => {
          const p = points[idx];
          if (!p) return null;
          return (
            <SvgText key={idx} x={p.x} y={CHART_HEIGHT - 6} fontSize={9} fontWeight="700" fill={textSecondary} textAnchor="middle">
              {labels[idx]}
            </SvgText>
          );
        })}
      </Svg>

      {points.map((p) => (
        <TouchableOpacity
          key={`hit-${p.idx}`}
          activeOpacity={0.7}
          onPress={() => onSelect(p.idx)}
          style={{
            position: 'absolute',
            left: p.x - 18,
            top: p.y - 18,
            width: 36,
            height: 36,
          }}
        />
      ))}
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
  const [chartWidth, setChartWidth] = useState(0);

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
    return { total, lastIdx, lastVal, lastLabel: labels[lastIdx] || '', changePct };
  }, [revenue, labels]);

  const highlightIdx = selectedIdx ?? stats.lastIdx;

  const changeIcon =
    stats.changePct === null || stats.changePct === 0 ? (
      <Minus size={12} color={textSecondary} />
    ) : stats.changePct > 0 ? (
      <TrendingUp size={12} color="#10B981" />
    ) : (
      <TrendingDown size={12} color="#EF4444" />
    );

  const onLayout = (e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  };

  const periodTitle =
    timeframe === 'month'
      ? t('trendThisMonthTitle', 'Revenue this month')
      : timeframe === 'daily'
        ? t('trend7DaysTitle', 'Revenue last 7 days')
        : t('trend3MonthsTitle', 'Revenue last 3 months');

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
          <View style={styles.totalRow}>
            <View>
              <Text style={[styles.totalLabel, { color: textSecondary }]}>{t('trendTotal', 'Total')}</Text>
              <Text style={[styles.totalValue, { color: textPrimary }]}>{formatFullCurrency(stats.total)}</Text>
            </View>
            <View style={styles.changeBlock}>
              {changeIcon}
              <Text
                style={[
                  styles.changeText,
                  {
                    color:
                      stats.changePct === null || stats.changePct === 0
                        ? textSecondary
                        : stats.changePct > 0
                          ? '#10B981'
                          : '#EF4444',
                  },
                ]}
              >
                {stats.changePct === null
                  ? t('trendNoCompare', '— vs previous')
                  : `${stats.changePct > 0 ? '+' : ''}${stats.changePct}% ${t('trendVsPrevious', 'vs previous')}`}
              </Text>
            </View>
          </View>

          <View style={[styles.graphBox, { borderColor }]} onLayout={onLayout}>
            {chartWidth > 0 ? (
              <LineGraph
                labels={labels}
                values={revenue}
                width={chartWidth}
                selectedIdx={highlightIdx}
                onSelect={setSelectedIdx}
                textSecondary={textSecondary}
              />
            ) : null}
          </View>

          <View style={[styles.tooltip, { backgroundColor: surfaceBg, borderColor }]}>
            <Text style={[styles.tooltipValue, { color: textPrimary }]}>
              {formatFullCurrency(revenue[highlightIdx] ?? 0)}
            </Text>
            <Text style={[styles.tooltipLabel, { color: textSecondary }]}>
              {labels[highlightIdx] || '—'}
              {highlightIdx === stats.lastIdx ? ` · ${t('trendLatest', 'Latest')}` : ''}
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
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  totalValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  changeBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeText: { fontSize: 11, fontWeight: '700' },
  graphBox: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 10, minHeight: CHART_HEIGHT },
  tooltip: { borderRadius: 10, padding: 10, borderWidth: 1, alignItems: 'center' },
  tooltipValue: { fontSize: 18, fontWeight: '900' },
  tooltipLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
