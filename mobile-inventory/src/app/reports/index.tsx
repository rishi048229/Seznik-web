import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  TrendingUp,
  Share2,
  DollarSign,
  Receipt,
  TrendingDown,
  Search,
  Package,
  FileSpreadsheet,
  FileText,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useReports } from '@/hooks/useReports';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ReportsSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { useTranslation } from '@/store/useLanguageStore';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

export default function ReportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const storeProfile = useStoreProfile();

  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'pnl'>('sales');
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'year'>('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportingType, setExportingType] = useState<'excel' | 'pdf' | null>(null);

  const { data, productsReport, isLoading, isRefetching, isError, refetchAll } = useReports(period);

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today':
        return 'Today';
      case '7days':
        return 'Last 7 Days';
      case '30days':
        return 'This Month (30 Days)';
      case 'year':
        return 'This Year';
      default:
        return period;
    }
  }, [period]);

  const filteredProducts = useMemo(() => {
    if (!productsReport) return [];
    if (!searchQuery.trim()) return productsReport;
    const q = searchQuery.toLowerCase().trim();
    return productsReport.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
    );
  }, [productsReport, searchQuery]);

  const totalProductUnits = useMemo(
    () => (productsReport || []).reduce((acc, p) => acc + (p.unitsSold || 0), 0),
    [productsReport]
  );

  const totalProductRevenue = useMemo(
    () => (productsReport || []).reduce((acc, p) => acc + (p.revenue || 0), 0),
    [productsReport]
  );

  const handleShareReport = () => {
    const summary = `*Seznik POS Financial Summary*\nPeriod: ${periodLabel}\nStore: ${storeProfile.storeName}\nTotal Revenue: ₹${(
      data?.totalSales || 0
    ).toFixed(2)}\nGross Profit: ₹${(data?.grossProfit || 0).toFixed(2)}\nTotal Expenses: ₹${(
      data?.totalExpenses || 0
    ).toFixed(2)}\nInvoices Billed: ${data?.invoiceCount || 0}\nTotal Products Sold: ${totalProductUnits}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(summary)}`);
  };

  const handleExportExcel = async () => {
    try {
      setExportingType('excel');
      const now = new Date().toLocaleString('en-IN');

      let csv = '\uFEFF'; // UTF-8 BOM for Excel compatibility
      csv += `"${storeProfile.storeName || 'Seznik Store'}"\n`;
      if (storeProfile.storeAddress) csv += `"${storeProfile.storeAddress.replace(/"/g, '""')}"\n`;
      if (storeProfile.storeGstin) csv += `"GSTIN: ${storeProfile.storeGstin}"\n`;
      if (storeProfile.storePhone) csv += `"Phone: ${storeProfile.storePhone}"\n`;
      csv += `"Financial & Sales Report: ${periodLabel}"\n`;
      csv += `"Generated At: ${now}"\n\n`;

      csv += `--- FINANCIAL SUMMARY ---\n`;
      csv += `Metric,Value\n`;
      csv += `Total Sales Revenue,"₹${(data?.totalSales || 0).toFixed(2)}"\n`;
      csv += `Invoices Count,${data?.invoiceCount || 0}\n`;
      csv += `Gross Profit,"₹${(data?.grossProfit || 0).toFixed(2)}"\n`;
      csv += `Total Expenses,"₹${(data?.totalExpenses || 0).toFixed(2)}"\n\n`;

      csv += `--- SALES BY PRODUCT (${periodLabel}) ---\n`;
      csv += `Rank,Product Name,Category,Units Sold,Avg Price (₹),Total Revenue (₹)\n`;

      (productsReport || []).forEach((p, idx) => {
        const cleanName = (p.name || '').replace(/"/g, '""');
        const cleanCategory = (p.categoryName || 'General').replace(/"/g, '""');
        csv += `${idx + 1},"${cleanName}","${cleanCategory}",${p.unitsSold || 0},${(
          p.averagePrice || 0
        ).toFixed(2)},${(p.revenue || 0).toFixed(2)}\n`;
      });

      const fileName = `Sales_Report_${period}_${Date.now()}.csv`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Sales Report (Excel / CSV)',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Export Saved', `Saved to ${filePath}`);
      }
    } catch (err: any) {
      console.error('Excel Export error:', err);
      Alert.alert('Export Failed', sanitizeErrorMessage(err, 'Unable to export Excel report. Please try again.'));
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportingType('pdf');
      const now = new Date().toLocaleString('en-IN');

      const productRowsHtml = (productsReport || [])
        .map(
          (p, idx) => `
          <tr style="border-bottom: 1px solid #E2E8F0; font-size: 12px;">
            <td style="padding: 8px 6px; text-align: center; color: #64748B;">${idx + 1}</td>
            <td style="padding: 8px 6px; font-weight: 600; color: #1E293B;">${p.name}</td>
            <td style="padding: 8px 6px; color: #64748B;">${p.categoryName || 'General'}</td>
            <td style="padding: 8px 6px; text-align: right; font-weight: 600;">${p.unitsSold || 0}</td>
            <td style="padding: 8px 6px; text-align: right; color: #64748B;">₹${(p.averagePrice || 0).toFixed(2)}</td>
            <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #2563EB;">₹${(p.revenue || 0).toFixed(2)}</td>
          </tr>
        `
        )
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Sales Report - ${periodLabel}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1E293B; margin: 0; padding: 24px; }
            .header { border-bottom: 2px solid #2563EB; padding-bottom: 14px; margin-bottom: 20px; }
            .store-name { font-size: 22px; font-weight: 800; color: #0F172A; }
            .store-meta { font-size: 12px; color: #64748B; margin-top: 2px; }
            .report-title { font-size: 18px; font-weight: 700; color: #2563EB; margin-top: 12px; }
            .grid { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 24px; }
            .card { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; background: #F8FAFC; }
            .card-label { font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 600; }
            .card-val { font-size: 18px; font-weight: 800; color: #0F172A; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #F1F5F9; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: 700; padding: 10px 6px; text-align: left; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-name">${storeProfile.storeName || 'Seznik Store'}</div>
            ${storeProfile.storeAddress ? `<div class="store-meta">${storeProfile.storeAddress}</div>` : ''}
            <div class="store-meta">
              ${storeProfile.storeGstin ? `GSTIN: ${storeProfile.storeGstin} &nbsp;·&nbsp; ` : ''}
              ${storeProfile.storePhone ? `Phone: ${storeProfile.storePhone}` : ''}
            </div>
            <div class="report-title">Sales & Financial Report (${periodLabel})</div>
            <div class="store-meta">Generated on: ${now}</div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-label">Total Revenue</div>
              <div class="card-val" style="color: #2563EB;">₹${(data?.totalSales || 0).toFixed(2)}</div>
            </div>
            <div class="card">
              <div class="card-label">Invoices Count</div>
              <div class="card-val">${data?.invoiceCount || 0}</div>
            </div>
            <div class="card">
              <div class="card-label">Gross Profit</div>
              <div class="card-val" style="color: #10B981;">₹${(data?.grossProfit || 0).toFixed(2)}</div>
            </div>
            <div class="card">
              <div class="card-label">Total Expenses</div>
              <div class="card-val" style="color: #EF4444;">₹${(data?.totalExpenses || 0).toFixed(2)}</div>
            </div>
          </div>

          <h3 style="font-size: 15px; margin-bottom: 6px; color: #0F172A;">Sales by Product Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 36px;">#</th>
                <th>Product Name</th>
                <th>Category</th>
                <th style="text-align: right;">Units</th>
                <th style="text-align: right;">Avg Price</th>
                <th style="text-align: right;">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${productRowsHtml || '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #94A3B8;">No product sales recorded for this period.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            Generated via Seznik POS · Professional Business Solutions
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Export Sales Report (PDF)',
        });
      } else {
        Alert.alert('PDF Generated', `Report PDF created at: ${uri}`);
      }
    } catch (err: any) {
      console.error('PDF Export error:', err);
      Alert.alert('Export Failed', sanitizeErrorMessage(err, 'Unable to generate PDF report. Please try again.'));
    } finally {
      setExportingType(null);
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={20} color={theme.textSecondary} />
              <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
            </TouchableOpacity>

            <View style={styles.actionsRow}>
              {/* Excel Export Button */}
              <TouchableOpacity
                onPress={handleExportExcel}
                disabled={exportingType !== null}
                style={[styles.exportBtn, { backgroundColor: '#107C41' }]}
              >
                {exportingType === 'excel' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FileSpreadsheet size={13} color="#FFFFFF" />
                    <Text style={styles.exportBtnText}>Excel</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* PDF Export Button */}
              <TouchableOpacity
                onPress={handleExportPdf}
                disabled={exportingType !== null}
                style={[styles.exportBtn, { backgroundColor: '#E11D48' }]}
              >
                {exportingType === 'pdf' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FileText size={13} color="#FFFFFF" />
                    <Text style={styles.exportBtnText}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Share Button */}
              <TouchableOpacity
                onPress={handleShareReport}
                style={[styles.exportBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
              >
                <Share2 size={13} color="#FFFFFF" />
                <Text style={styles.exportBtnText}>{t('share', 'Share')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {t('reportsPageTitle', 'Financial & Sales Reports')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('reportsSubtitle', 'Product sales, revenue trends & P&L margins')}
          </Text>

          {/* 3-Way Segmented Control: Sales | Products | P&L */}
          <View style={[styles.segmentedBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            {(['sales', 'products', 'pnl'] as const).map((tab) => {
              const selected = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.segBtn, selected && styles.segBtnActive]}
                >
                  <Text style={[styles.segText, selected && styles.segTextActive]}>
                    {tab === 'sales'
                      ? t('sales', 'Sales Trend')
                      : tab === 'products'
                      ? t('salesByProduct', 'By Product')
                      : t('grossMargin', 'P & L Summary')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Horizontal Time Period Switcher */}
          <View style={{ height: 44, marginBottom: 14 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center' }}
            >
              {[
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: '30days', label: 'This Month' },
                { id: 'year', label: 'This Year' },
              ].map((p) => {
                const selected = period === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setPeriod(p.id as any)}
                    style={[
                      styles.periodPill,
                      {
                        backgroundColor: selected ? BRAND_COLORS.blue600 : theme.cardBg,
                        borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodPillText,
                        { color: selected ? '#FFFFFF' : theme.textPrimary },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }}>
            {isLoading ? (
              <ScreenLoadingState
                message="Loading reports..."
                hint="Calculating sales and product summaries"
                skeleton={<ReportsSkeleton />}
              />
            ) : isError ? (
              <ScreenErrorState
                message="Could not load reports"
                hint="Check your connection and try again"
                onRetry={refetchAll}
                isRetrying={isRefetching}
              />
            ) : activeTab === 'products' ? (
              /* TAB 2: SALES BY PRODUCT */
              <>
                {/* Product Summary Strip */}
                <View style={styles.metricsStrip}>
                  <View style={[styles.metricItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Package size={16} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.metricVal, { color: theme.textPrimary }]}>
                      {productsReport?.length || 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Products Sold</Text>
                  </View>

                  <View style={[styles.metricItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <TrendingUp size={16} color="#10B981" />
                    <Text style={[styles.metricVal, { color: '#10B981' }]}>
                      {totalProductUnits}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Units</Text>
                  </View>

                  <View style={[styles.metricItem, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginRight: 0 }]}>
                    <DollarSign size={16} color={BRAND_COLORS.sky500} />
                    <Text style={[styles.metricVal, { color: BRAND_COLORS.blue600 }]}>
                      ₹{totalProductRevenue.toFixed(0)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Revenue</Text>
                  </View>
                </View>

                {/* Product Search Box */}
                <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Search size={16} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.textPrimary }]}
                    placeholder={t('searchProducts', 'Filter products or categories...')}
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <Text style={styles.sectionHeader}>
                  PRODUCT SALES RANKING ({filteredProducts.length} ITEMS)
                </Text>

                {filteredProducts.length === 0 ? (
                  <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, alignItems: 'center', paddingVertical: 32 }]}>
                    <Package size={36} color={theme.textSecondary} />
                    <Text style={[styles.cardTitle, { color: theme.textPrimary, marginTop: 10 }]}>
                      No product sales recorded
                    </Text>
                    <Text style={[styles.breakdownSub, { color: theme.textSecondary, marginTop: 4 }]}>
                      {searchQuery ? 'No products match your filter' : `No sales recorded for ${periodLabel}`}
                    </Text>
                  </View>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <View
                      key={p.id || `${p.name}-${idx}`}
                      style={[styles.productCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View
                          style={[
                            styles.rankBadge,
                            {
                              backgroundColor:
                                idx === 0
                                  ? 'rgba(245, 158, 11, 0.18)'
                                  : idx === 1
                                  ? 'rgba(100, 116, 139, 0.18)'
                                  : idx === 2
                                  ? 'rgba(217, 119, 6, 0.18)'
                                  : 'rgba(37, 99, 235, 0.08)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.rankText,
                              {
                                color:
                                  idx === 0
                                    ? '#D97706'
                                    : idx === 1
                                    ? '#64748B'
                                    : idx === 2
                                    ? '#B45309'
                                    : BRAND_COLORS.blue600,
                              },
                            ]}
                          >
                            #{idx + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                            <View style={[styles.categoryBadge, { backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}>
                              <Text style={[styles.categoryText, { color: BRAND_COLORS.blue600 }]}>
                                {p.categoryName || 'General'}
                              </Text>
                            </View>
                            <Text style={[styles.productMeta, { color: theme.textSecondary, marginLeft: 8 }]}>
                              {p.unitsSold} units · Avg ₹{(p.averagePrice || 0).toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.productRevenue, { color: BRAND_COLORS.blue600 }]}>
                          ₹{(p.revenue || 0).toFixed(2)}
                        </Text>
                        <Text style={[styles.productAvgPrice, { color: theme.textSecondary }]}>
                          {totalProductRevenue > 0
                            ? `${Math.round(((p.revenue || 0) / totalProductRevenue) * 100)}% of sales`
                            : ''}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : activeTab === 'sales' ? (
              /* TAB 1: SALES TREND */
              <>
                {/* Summary 2-Card Grid */}
                <View style={styles.summaryGrid}>
                  <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                      <TrendingUp size={20} color={BRAND_COLORS.blue600} />
                    </View>
                    <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Total Gross Sales</Text>
                    <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                      ₹{(data?.totalSales || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                      <Receipt size={20} color={BRAND_COLORS.sky500} />
                    </View>
                    <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Invoices Count</Text>
                    <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                      {data?.invoiceCount || 0}
                    </Text>
                  </View>
                </View>

                {/* Visual Performance Trend Chart */}
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 16 }]}>
                  <View style={styles.chartHeader}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Performance Trend</Text>
                    <Text style={styles.chartTag}>Live Analytics</Text>
                  </View>
                  {data.salesRevenue.length === 0 || data.salesRevenue.every((v: number) => v === 0) ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>No sales in this period</Text>
                    </View>
                  ) : (
                    <View style={styles.chartBox}>
                      {(() => {
                        const maxVal = Math.max(1, ...data.salesRevenue);
                        return data.salesRevenue.slice(-7).map((val: number, idx: number) => {
                          const heightPct = Math.max(8, Math.round((val / maxVal) * 100));
                          const label = (data.salesLabels || []).slice(-7)[idx] || `D${idx + 1}`;
                          const isLast = idx === Math.min(6, data.salesRevenue.length - 1);
                          return (
                            <View key={idx} style={styles.chartCol}>
                              <View
                                style={[
                                  styles.chartBar,
                                  {
                                    height: `${heightPct}%`,
                                    backgroundColor: isLast ? BRAND_COLORS.blue600 : BRAND_COLORS.navyInk,
                                  },
                                ]}
                              />
                              <Text style={[styles.chartLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                                {label}
                              </Text>
                            </View>
                          );
                        });
                      })()}
                    </View>
                  )}
                </View>

                {/* Quick Summary Strip */}
                <Text style={styles.sectionHeader}>SUMMARY OVERVIEW</Text>
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={[styles.breakdownRow, { borderBottomColor: theme.borderColor }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownTitle, { color: theme.textPrimary }]}>Total Revenue Billed</Text>
                      <Text style={[styles.breakdownSub, { color: theme.textSecondary }]}>Gross collection across payment modes</Text>
                    </View>
                    <Text style={[styles.breakdownVal, { color: BRAND_COLORS.blue600 }]}>
                      ₹{(data?.totalSales || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.breakdownRow, { borderBottomColor: 'transparent' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownTitle, { color: theme.textPrimary }]}>Average Ticket Size</Text>
                      <Text style={[styles.breakdownSub, { color: theme.textSecondary }]}>Revenue per invoice</Text>
                    </View>
                    <Text style={[styles.breakdownVal, { color: '#10B981' }]}>
                      ₹{data?.invoiceCount && data.invoiceCount > 0 ? ((data.totalSales || 0) / data.invoiceCount).toFixed(2) : '0.00'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              /* TAB 3: P&L SUMMARY */
              <>
                <View style={styles.summaryGrid}>
                  <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                      <DollarSign size={20} color="#10B981" />
                    </View>
                    <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Gross Profit Margin</Text>
                    <Text style={[styles.cardValue, { color: '#10B981' }]}>
                      ₹{(data?.grossProfit || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <TrendingDown size={20} color="#EF4444" />
                    </View>
                    <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Total Expenses</Text>
                    <Text style={[styles.cardValue, { color: '#EF4444' }]}>
                      -₹{(data?.totalExpenses || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionHeader}>ITEMIZED FINANCIAL BREAKDOWN</Text>
                <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={[styles.breakdownRow, { borderBottomColor: theme.borderColor }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownTitle, { color: theme.textPrimary }]}>Sales Revenue (Net)</Text>
                      <Text style={[styles.breakdownSub, { color: theme.textSecondary }]}>Total invoices billed</Text>
                    </View>
                    <Text style={[styles.breakdownVal, { color: '#10B981' }]}>
                      +₹{(data?.totalSales || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={[styles.breakdownRow, { borderBottomColor: theme.borderColor }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownTitle, { color: theme.textPrimary }]}>Operating Expenses</Text>
                      <Text style={[styles.breakdownSub, { color: theme.textSecondary }]}>Rent, salaries & utility costs</Text>
                    </View>
                    <Text style={[styles.breakdownVal, { color: '#EF4444' }]}>
                      -₹{(data?.totalExpenses || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={[styles.breakdownRow, { borderBottomColor: 'transparent' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownTitle, { color: theme.textPrimary }]}>Net Profit Retained</Text>
                      <Text style={[styles.breakdownSub, { color: theme.textSecondary }]}>After expense deductions</Text>
                    </View>
                    <Text style={[styles.breakdownVal, { color: BRAND_COLORS.blue600 }]}>
                      ₹{(data?.grossProfit || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exportBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 16 },
  segmentedBar: { flexDirection: 'row', padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  segBtnActive: { backgroundColor: BRAND_COLORS.blue600 },
  segText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  segTextActive: { color: '#FFFFFF' },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    height: 36,
    justifyContent: 'center',
  },
  periodPillText: { fontSize: 12, fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryCard: { width: '48.5%', padding: 16, borderRadius: 18, borderWidth: 1 },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 11, fontWeight: '600' },
  cardValue: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartTag: { fontSize: 10, fontWeight: '800', color: BRAND_COLORS.sky500, textTransform: 'uppercase' },
  chartBox: { height: 110, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartCol: { width: 28, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { width: 14, borderRadius: 6, marginBottom: 6 },
  chartLabel: { fontSize: 10, fontWeight: '700' },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  breakdownTitle: { fontSize: 14, fontWeight: '800' },
  breakdownSub: { fontSize: 11, marginTop: 2 },
  breakdownVal: { fontSize: 15, fontWeight: '900' },
  metricsStrip: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metricItem: { flex: 1, padding: 10, borderRadius: 14, borderWidth: 1, marginRight: 8, alignItems: 'center' },
  metricVal: { fontSize: 15, fontWeight: '900', marginTop: 4 },
  metricLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13 },
  productCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankText: { fontSize: 11, fontWeight: '900' },
  productName: { fontSize: 13, fontWeight: '800' },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  categoryText: { fontSize: 9, fontWeight: '700' },
  productMeta: { fontSize: 10 },
  productRevenue: { fontSize: 14, fontWeight: '900' },
  productAvgPrice: { fontSize: 9, marginTop: 2 },
});
