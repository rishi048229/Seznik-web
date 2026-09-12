import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  G,
} from 'react-native-svg';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  RotateCcw,
  Sparkles,
  Award,
} from 'lucide-react-native';
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
  { id: 'daily', labelKey: 'trend7Days', fallback: '7 Days' },
  { id: 'month', labelKey: 'trendThisMonth', fallback: 'This Month' },
  { id: 'monthly', labelKey: 'trend3Months', fallback: '3 Months' },
];

const CHART_HEIGHT = 160;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 28;
const PADDING_HORIZONTAL = 18;

function formatCurrency(val: number): string {
  return `₹${Math.round(val || 0).toLocaleString('en-IN')}`;
}

function formatCompact(val: number): string {
  const n = Math.max(0, val || 0);
  if (n === 0) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

/** Converts array of points into a smooth cubic Catmull-Rom spline path */
function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 5.5;
    const cp1y = p1.y + (p2.y - p0.y) / 5.5;

    const cp2x = p2.x - (p3.x - p1.x) / 5.5;
    const cp2y = p2.y - (p3.y - p1.y) / 5.5;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

/** Generates closed polygon path for smooth gradient fill */
function getAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return '';
  const linePath = getSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(1)} ${baselineY} L ${first.x.toFixed(1)} ${baselineY} Z`;
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
  const [chartWidth, setChartWidth] = useState<number>(330);

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

    const nonZeroCount = revenue.filter((v) => v > 0).length;
    const avgPerDay = nonZeroCount > 0 ? Math.round(total / (revenue.length || 1)) : 0;

    let bestIdx = 0;
    let bestVal = 0;
    revenue.forEach((v, i) => {
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    });

    const maxVal = Math.max(100, bestVal * 1.12);

    return {
      total,
      lastIdx,
      lastVal,
      lastLabel: labels[lastIdx] || '',
      changePct,
      bestIdx,
      bestVal,
      bestLabel: labels[bestIdx] || '',
      avgPerDay,
      maxVal,
      isLatestToday: (labels[lastIdx] || '').toLowerCase() === 'today',
    };
  }, [revenue, labels]);

  const activeIdx = selectedIdx !== null ? selectedIdx : stats.lastIdx;
  const activeVal = revenue[activeIdx] ?? 0;
  const activeLabel = labels[activeIdx] || '—';
  const isCustomSelected = selectedIdx !== null;

  const periodTitle =
    timeframe === 'month'
      ? t('trendThisMonthTitle', 'This Month Flow')
      : timeframe === 'daily'
        ? t('trend7DaysTitle', 'Last 7 Days Flow')
        : t('trend3MonthsTitle', '3 Months Overview');

  const vsPreviousLabel =
    timeframe === 'monthly'
      ? t('trendVsPreviousMonth', 'vs prev month')
      : t('trendVsPrevious', 'vs prev day');

  // Compute SVG Points
  const usableWidth = Math.max(100, chartWidth - PADDING_HORIZONTAL * 2);
  const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const baselineY = CHART_HEIGHT - PADDING_BOTTOM;

  const points = useMemo(() => {
    if (!revenue.length) return [];
    const step = revenue.length > 1 ? usableWidth / (revenue.length - 1) : usableWidth;

    return revenue.map((val, i) => {
      const x = PADDING_HORIZONTAL + i * step;
      const ratio = val / stats.maxVal;
      const y = baselineY - ratio * usableHeight;
      return { x, y: Math.max(PADDING_TOP, Math.min(baselineY, y)), val, idx: i };
    });
  }, [revenue, stats.maxVal, usableWidth, usableHeight, baselineY]);

  const areaD = useMemo(() => getAreaPath(points, baselineY), [points, baselineY]);
  const lineD = useMemo(() => getSmoothPath(points), [points]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 50) {
      setChartWidth(width);
    }
  };

  const activePoint = points[activeIdx] || points[points.length - 1];

  return (
    <View style={[styles.containerCard, { backgroundColor: cardBg, borderColor }]}>
      {/* 1. Header with Title & Period Selector */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.headerIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
              <Sparkles size={16} color={BRAND_COLORS.blue600} />
            </View>
            <Text style={[styles.chartTitle, { color: textPrimary }]}>
              {t('revenueTrend', 'Revenue Curve')}
            </Text>
          </View>
          <Text style={[styles.chartSubtitle, { color: textSecondary }]}>
            {periodTitle}
          </Text>
        </View>

        {/* Timeframe Segmented Control */}
        <View style={[styles.timeframePillContainer, { backgroundColor: surfaceBg, borderColor }]}>
          {PERIOD_OPTIONS.map((opt) => {
            const active = timeframe === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  setSelectedIdx(null);
                  onTimeframeChange(opt.id);
                }}
                activeOpacity={0.7}
                style={[
                  styles.timeframeSegment,
                  active && styles.timeframeSegmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.timeframeSegmentText,
                    { color: active ? '#FFFFFF' : textSecondary },
                  ]}
                >
                  {t(opt.labelKey, opt.fallback)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Loading / Empty State or Chart Body */}
      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
          <Text style={[styles.stateText, { color: textSecondary }]}>
            {t('loadingTrend', 'Generating revenue flow...')}
          </Text>
        </View>
      ) : !hasData ? (
        <View style={styles.stateContainer}>
          <Calendar size={28} color={textSecondary} style={{ opacity: 0.6, marginBottom: 6 }} />
          <Text style={[styles.stateText, { color: textSecondary }]}>
            {t('trendNoSales', 'No sales recorded in this period yet. New bills will appear here live.')}
          </Text>
        </View>
      ) : (
        <>
          {/* 3. Hero Showcase Card */}
          <View style={[styles.heroDisplayCard, { backgroundColor: surfaceBg, borderColor }]}>
            <View style={styles.heroMainRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.heroDateLabel, { color: textSecondary }]}>
                    {isCustomSelected
                      ? `${activeLabel} ${activeIdx === stats.bestIdx && stats.bestVal > 0 ? '• Peak' : ''}`
                      : stats.isLatestToday
                        ? t('todayRevenue', "Today's Revenue")
                        : activeLabel}
                  </Text>
                  {isCustomSelected && (
                    <TouchableOpacity
                      onPress={() => setSelectedIdx(null)}
                      style={styles.resetSelectionBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <RotateCcw size={10} color={BRAND_COLORS.blue600} />
                      <Text style={styles.resetSelectionText}>Latest</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.heroAmountText, { color: textPrimary }]}>
                  {formatCurrency(activeVal)}
                </Text>
              </View>

              {/* Growth Badge */}
              {stats.changePct !== null ? (
                <View
                  style={[
                    styles.growthBadge,
                    {
                      backgroundColor:
                        stats.changePct >= 0
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                      borderColor:
                        stats.changePct >= 0
                          ? 'rgba(16, 185, 129, 0.25)'
                          : 'rgba(239, 68, 68, 0.25)',
                    },
                  ]}
                >
                  {stats.changePct >= 0 ? (
                    <TrendingUp size={13} color="#10B981" />
                  ) : (
                    <TrendingDown size={13} color="#EF4444" />
                  )}
                  <Text
                    style={[
                      styles.growthBadgeText,
                      { color: stats.changePct >= 0 ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {stats.changePct >= 0 ? `+${stats.changePct}%` : `${stats.changePct}%`}
                  </Text>
                  <Text style={[styles.growthSubText, { color: textSecondary }]}>
                    {vsPreviousLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 4. Smooth Gradient Area Spline Chart (SVG) */}
          <View style={[styles.chartWrapper, { borderColor }]} onLayout={onLayout}>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              <Defs>
                {/* Glowing Smooth Gradient */}
                <LinearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={BRAND_COLORS.blue600} stopOpacity="0.45" />
                  <Stop offset="60%" stopColor="#38BDF8" stopOpacity="0.15" />
                  <Stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                </LinearGradient>
              </Defs>

              {/* Horizontal Reference Grid Guide Lines */}
              <G opacity={0.25}>
                <Line
                  x1={PADDING_HORIZONTAL}
                  y1={PADDING_TOP}
                  x2={chartWidth - PADDING_HORIZONTAL}
                  y2={PADDING_TOP}
                  stroke={borderColor}
                  strokeDasharray="4, 4"
                  strokeWidth={1}
                />
                <Line
                  x1={PADDING_HORIZONTAL}
                  y1={PADDING_TOP + usableHeight / 2}
                  x2={chartWidth - PADDING_HORIZONTAL}
                  y2={PADDING_TOP + usableHeight / 2}
                  stroke={borderColor}
                  strokeDasharray="4, 4"
                  strokeWidth={1}
                />
                <Line
                  x1={PADDING_HORIZONTAL}
                  y1={baselineY}
                  x2={chartWidth - PADDING_HORIZONTAL}
                  y2={baselineY}
                  stroke={borderColor}
                  strokeWidth={1}
                />
              </G>

              {/* Gradient Area Fill */}
              {areaD ? <Path d={areaD} fill="url(#revenueGrad)" /> : null}

              {/* Spline Line */}
              {lineD ? (
                <Path
                  d={lineD}
                  fill="none"
                  stroke={BRAND_COLORS.blue600}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {/* Active Scrubber Line */}
              {activePoint ? (
                <Line
                  x1={activePoint.x}
                  y1={PADDING_TOP}
                  x2={activePoint.x}
                  y2={baselineY}
                  stroke={BRAND_COLORS.blue600}
                  strokeWidth={1.5}
                  strokeDasharray="3, 3"
                  opacity={0.7}
                />
              ) : null}

              {/* Data Points on Line */}
              {points.map((pt, i) => {
                const isSelected = i === activeIdx;
                const isBest = i === stats.bestIdx && pt.val > 0;

                if (isSelected) {
                  return (
                    <G key={`point-${i}`}>
                      <Circle
                        cx={pt.x}
                        cy={pt.y}
                        r={10}
                        fill={BRAND_COLORS.blue600}
                        opacity={0.22}
                      />
                      <Circle
                        cx={pt.x}
                        cy={pt.y}
                        r={5}
                        fill={BRAND_COLORS.blue600}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    </G>
                  );
                }

                if (isBest) {
                  return (
                    <Circle
                      key={`point-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={4.5}
                      fill="#10B981"
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  );
                }

                if (points.length <= 10 && pt.val > 0) {
                  return (
                    <Circle
                      key={`point-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={3}
                      fill={BRAND_COLORS.blue600}
                      opacity={0.7}
                    />
                  );
                }

                return null;
              })}
            </Svg>

            {/* Interactive Touch Overlay Zones */}
            <View style={styles.touchOverlayLayer}>
              {points.map((pt, i) => (
                <TouchableOpacity
                  key={`touch-zone-${i}`}
                  activeOpacity={0.8}
                  onPress={() => setSelectedIdx(i)}
                  style={styles.touchTarget}
                />
              ))}
            </View>

            {/* X-Axis Labels Row */}
            <View style={styles.xAxisRow}>
              {labels.map((label, i) => {
                const isSelected = i === activeIdx;
                return (
                  <TouchableOpacity
                    key={`label-${i}`}
                    onPress={() => setSelectedIdx(i)}
                    style={{ flex: 1, alignItems: 'center' }}
                  >
                    <Text
                      style={[
                        styles.xAxisText,
                        {
                          color: isSelected ? BRAND_COLORS.blue600 : textSecondary,
                          fontWeight: isSelected ? '900' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 5. 3-Column KPI Summary Tiles */}
          <View style={styles.kpiTilesRow}>
            {/* Tile 1: Period Total */}
            <View style={[styles.kpiTile, { backgroundColor: surfaceBg, borderColor }]}>
              <Text style={[styles.kpiLabel, { color: textSecondary }]}>
                {t('trendTotal', 'Period Total')}
              </Text>
              <Text style={[styles.kpiValue, { color: BRAND_COLORS.blue600 }]} numberOfLines={1}>
                {formatCompact(stats.total)}
              </Text>
            </View>

            {/* Tile 2: Daily Average */}
            <View style={[styles.kpiTile, { backgroundColor: surfaceBg, borderColor }]}>
              <Text style={[styles.kpiLabel, { color: textSecondary }]}>
                {t('avgPerDay', 'Daily Avg')}
              </Text>
              <Text style={[styles.kpiValue, { color: textPrimary }]} numberOfLines={1}>
                {formatCompact(stats.avgPerDay)}
              </Text>
            </View>

            {/* Tile 3: Peak Day */}
            <View style={[styles.kpiTile, { backgroundColor: surfaceBg, borderColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Award size={11} color="#10B981" />
                <Text style={[styles.kpiLabel, { color: textSecondary }]}>
                  {t('peakDay', 'Peak Day')}
                </Text>
              </View>
              <Text style={[styles.kpiValue, { color: '#10B981' }]} numberOfLines={1}>
                {stats.bestVal > 0 ? formatCompact(stats.bestVal) : '₹0'}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  chartSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  timeframePillContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  timeframeSegment: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeSegmentActive: {
    backgroundColor: BRAND_COLORS.blue600,
    shadowColor: BRAND_COLORS.blue600,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  timeframeSegmentText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  stateContainer: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  stateText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  heroDisplayCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resetSelectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  resetSelectionText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: BRAND_COLORS.blue600,
  },
  heroAmountText: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  growthBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  growthSubText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  chartWrapper: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    height: CHART_HEIGHT,
    marginBottom: 12,
    position: 'relative',
    justifyContent: 'flex-start',
  },
  touchOverlayLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
  },
  touchTarget: {
    flex: 1,
    height: '100%',
  },
  xAxisRow: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: PADDING_HORIZONTAL - 10,
  },
  xAxisText: {
    fontSize: 9.5,
    textAlign: 'center',
  },
  kpiTilesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiTile: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
  },
});
