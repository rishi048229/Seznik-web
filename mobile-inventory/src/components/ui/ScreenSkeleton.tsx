import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, ViewStyle, Easing } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width: screenWidth } = Dimensions.get('window');

interface SkeletonBlockProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

export function SkeletonBlock({
  width = '100%',
  height = 20,
  borderRadius = 10,
  style,
}: SkeletonBlockProps) {
  const theme = useAppTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const skeletonBg = theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';
  const shimmerColor = theme.isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.70)';
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth - 60, screenWidth + 60],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: skeletonBg,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerBand,
          {
            backgroundColor: shimmerColor,
            transform: [{ translateX: shimmerTranslate }, { rotate: '18deg' }],
          },
        ]}
      />
    </Animated.View>
  );
}

/**
 * Pixel-Perfect Skeleton for Dashboard Screen
 */
export function DashboardSkeleton() {
  const theme = useAppTheme();

  return (
    <View style={{ paddingTop: 4 }}>
      {/* 1. Quick Access Section Header */}
      <View style={styles.sectionHeaderRow}>
        <SkeletonBlock width={120} height={14} borderRadius={4} />
        <SkeletonBlock width={80} height={14} borderRadius={4} />
      </View>

      {/* 2. Primary 4 Quick Access App Launcher Tiles (Exact compactGridRow) */}
      <View style={styles.compactGridRow}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.tileBox,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            ]}
          >
            <SkeletonBlock width={36} height={36} borderRadius={18} style={{ marginBottom: 6 }} />
            <SkeletonBlock width={52} height={11} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Show More / Show Less Pill */}
      <View
        style={[
          styles.showMorePill,
          { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
        ]}
      >
        <SkeletonBlock width={160} height={13} borderRadius={4} />
      </View>

      {/* 3. Executive Metrics Section Title */}
      <SkeletonBlock width={190} height={13} borderRadius={4} style={{ marginTop: 20, marginBottom: 10 }} />

      {/* 4. 2x2 Performance KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.kpiCard,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            ]}
          >
            <View style={styles.rowBetween}>
              <SkeletonBlock width="55%" height={12} borderRadius={4} />
              <SkeletonBlock width={28} height={28} borderRadius={14} />
            </View>
            <SkeletonBlock width="75%" height={22} borderRadius={6} style={{ marginTop: 10, marginBottom: 6 }} />
            <SkeletonBlock width="45%" height={10} borderRadius={3} />
          </View>
        ))}
      </View>

      {/* 5. Payment Modes & Expense Dual Cards */}
      <SkeletonBlock width={230} height={13} borderRadius={4} style={{ marginTop: 22, marginBottom: 10 }} />
      <View style={styles.dualSectionRow}>
        {/* Payment Modes Half Card */}
        <View style={[styles.halfCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <SkeletonBlock width={90} height={13} borderRadius={4} />
            <SkeletonBlock width={16} height={16} borderRadius={8} />
          </View>
          {[1, 2, 3].map((item) => (
            <View key={item} style={{ marginBottom: 8 }}>
              <View style={[styles.rowBetween, { marginBottom: 4 }]}>
                <SkeletonBlock width={40} height={10} borderRadius={3} />
                <SkeletonBlock width={60} height={10} borderRadius={3} />
              </View>
              <SkeletonBlock width="100%" height={6} borderRadius={3} />
            </View>
          ))}
        </View>

        {/* Expense Summary Half Card */}
        <View style={[styles.halfCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <SkeletonBlock width={90} height={13} borderRadius={4} />
            <SkeletonBlock width={16} height={16} borderRadius={8} />
          </View>
          <SkeletonBlock width={70} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
          <SkeletonBlock width={100} height={22} borderRadius={6} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={80} height={10} borderRadius={3} />
        </View>
      </View>

      {/* 6. Revenue Trend Chart Container */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
        ]}
      >
        <View style={[styles.rowBetween, { marginBottom: 16 }]}>
          <SkeletonBlock width={110} height={14} borderRadius={4} />
          <SkeletonBlock width={130} height={24} borderRadius={12} />
        </View>
        <View style={styles.chartBarsRow}>
          {[40, 65, 30, 85, 55, 90, 70].map((h, idx) => (
            <View key={idx} style={{ alignItems: 'center', flex: 1 }}>
              <SkeletonBlock width={22} height={h} borderRadius={4} style={{ marginBottom: 6 }} />
              <SkeletonBlock width={18} height={8} borderRadius={2} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Pixel-Perfect Skeleton for Products Screen
 */
export function ProductsListSkeleton({ count = 6 }: { count?: number }) {
  const theme = useAppTheme();

  return (
    <View style={{ paddingTop: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.productCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          {/* Left: Product Image Box */}
          <SkeletonBlock width={54} height={54} borderRadius={14} />

          {/* Middle: Product Details */}
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <SkeletonBlock width="70%" height={15} borderRadius={5} style={{ marginBottom: 6 }} />
            <SkeletonBlock width="50%" height={11} borderRadius={4} style={{ marginBottom: 6 }} />
            <SkeletonBlock width={85} height={18} borderRadius={6} />
          </View>

          {/* Right: Barcode & Actions */}
          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <SkeletonBlock width={32} height={32} borderRadius={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Pixel-Perfect Skeleton for POS 2-Column Product Grid
 */
export function PosGridSkeleton() {
  const theme = useAppTheme();

  return (
    <View style={styles.posGridRow}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View
          key={i}
          style={[
            styles.posTile,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          {/* Top Product Image */}
          <SkeletonBlock width="100%" height={88} borderRadius={12} style={{ marginBottom: 8 }} />

          {/* Product Name (2 lines) */}
          <SkeletonBlock width="85%" height={13} borderRadius={4} style={{ marginBottom: 4 }} />
          <SkeletonBlock width="55%" height={13} borderRadius={4} style={{ marginBottom: 8 }} />

          {/* Bottom Price & Add Button Row */}
          <View style={styles.rowBetween}>
            <SkeletonBlock width="45%" height={16} borderRadius={4} />
            <SkeletonBlock width={28} height={28} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Pixel-Perfect Skeleton for Sales History Screen
 */
export function SalesListSkeleton({ count = 5 }: { count?: number }) {
  const theme = useAppTheme();

  return (
    <View style={{ paddingTop: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.saleCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          <View style={{ flex: 1 }}>
            {/* Top Row: Invoice Number + Payment Pill */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <SkeletonBlock width={95} height={16} borderRadius={4} />
              <SkeletonBlock width={55} height={18} borderRadius={6} style={{ marginLeft: 8 }} />
            </View>
            {/* Subtitle: Date & Customer Name */}
            <SkeletonBlock width="60%" height={11} borderRadius={4} />
          </View>

          {/* Right Side: Total Amount */}
          <View style={{ alignItems: 'flex-end' }}>
            <SkeletonBlock width={75} height={18} borderRadius={5} style={{ marginBottom: 4 }} />
            <SkeletonBlock width={40} height={10} borderRadius={3} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Pixel-Perfect Skeleton for Customers & Credit Ledger Screen
 */
export function CustomersListSkeleton({ count = 6 }: { count?: number }) {
  const theme = useAppTheme();

  return (
    <View style={{ paddingTop: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.customerCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          {/* Avatar Circle */}
          <SkeletonBlock width={42} height={42} borderRadius={21} />

          {/* Customer Name & Phone */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <SkeletonBlock width="65%" height={15} borderRadius={4} style={{ marginBottom: 6 }} />
            <SkeletonBlock width="45%" height={11} borderRadius={4} />
          </View>

          {/* Due Balance Status Pill */}
          <View style={{ alignItems: 'flex-end' }}>
            <SkeletonBlock width={72} height={20} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Pixel-Perfect Skeleton for Daybook & Cashflow Screen
 */
export function DaybookSkeleton() {
  const theme = useAppTheme();

  return (
    <View style={{ paddingTop: 4 }}>
      {/* Cashflow Top Metrics Cards */}
      <SkeletonBlock width={140} height={12} borderRadius={4} style={{ marginBottom: 10 }} />
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <View
          style={[
            styles.halfCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          <SkeletonBlock width={20} height={20} borderRadius={10} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={50} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
          <SkeletonBlock width={80} height={18} borderRadius={5} />
        </View>

        <View
          style={[
            styles.halfCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          <SkeletonBlock width={20} height={20} borderRadius={10} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={50} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
          <SkeletonBlock width={80} height={18} borderRadius={5} />
        </View>
      </View>

      {/* Transaction List Header */}
      <SkeletonBlock width={160} height={12} borderRadius={4} style={{ marginBottom: 10 }} />

      {/* Cashflow Transaction Rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.customerCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          <SkeletonBlock width={36} height={36} borderRadius={18} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <SkeletonBlock width="55%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="40%" height={10} borderRadius={3} />
          </View>
          <SkeletonBlock width={65} height={16} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

/**
 * Pixel-Perfect Skeleton for Reports Screen
 */
export function ReportsSkeleton() {
  const theme = useAppTheme();

  return (
    <View style={{ paddingTop: 4 }}>
      {/* 2-Card Summary Grid */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <SkeletonBlock width={24} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
          <SkeletonBlock width={85} height={11} borderRadius={3} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={110} height={22} borderRadius={6} />
        </View>

        <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <SkeletonBlock width={24} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
          <SkeletonBlock width={85} height={11} borderRadius={3} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={110} height={22} borderRadius={6} />
        </View>
      </View>

      {/* Detailed Financial Breakdown Card */}
      <View style={[styles.chartCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 14 }]}>
        <SkeletonBlock width={140} height={15} borderRadius={4} style={{ marginBottom: 14 }} />
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={[styles.rowBetween, { marginBottom: 12 }]}>
            <SkeletonBlock width="40%" height={13} borderRadius={4} />
            <SkeletonBlock width="30%" height={14} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Generic List Screen Skeleton (Suppliers, Purchases, Expenses, Categories, Staff, Quick Tokens)
 */
export function ListScreenSkeleton({
  hasSearch = false,
  hasStats = false,
  count = 5,
}: {
  hasSearch?: boolean;
  hasStats?: boolean;
  count?: number;
}) {
  const theme = useAppTheme();

  return (
    <View style={{ paddingTop: 4 }}>
      {hasSearch && (
        <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <SkeletonBlock width={20} height={20} borderRadius={10} style={{ marginRight: 10 }} />
          <SkeletonBlock width="65%" height={15} borderRadius={5} />
        </View>
      )}

      {hasStats && (
        <View style={[styles.statsBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBlock width={60} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
            <SkeletonBlock width={80} height={16} borderRadius={4} />
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: theme.borderColor }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBlock width={60} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
            <SkeletonBlock width={80} height={16} borderRadius={4} />
          </View>
        </View>
      )}

      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.productCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
        >
          <SkeletonBlock width={44} height={44} borderRadius={12} />
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <SkeletonBlock width="65%" height={15} borderRadius={5} style={{ marginBottom: 6 }} />
            <SkeletonBlock width="45%" height={11} borderRadius={4} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <SkeletonBlock width={60} height={16} borderRadius={5} style={{ marginBottom: 4 }} />
            <SkeletonBlock width={40} height={11} borderRadius={3} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** KOT order list cards — badge, meta, item preview box, footer total */
export function KotOrdersListSkeleton({ count = 4 }: { count?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ paddingTop: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.kotOrderCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <SkeletonBlock width={42} height={22} borderRadius={8} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <SkeletonBlock width="55%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
                <SkeletonBlock width="40%" height={10} borderRadius={3} />
              </View>
            </View>
            <SkeletonBlock width={64} height={20} borderRadius={8} />
          </View>
          <View style={[styles.kotItemsPreview, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
            {[1, 2].map((row) => (
              <View key={row} style={[styles.rowBetween, { marginBottom: 6 }]}>
                <SkeletonBlock width="62%" height={11} borderRadius={3} />
                <SkeletonBlock width={48} height={11} borderRadius={3} />
              </View>
            ))}
          </View>
          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <SkeletonBlock width={70} height={10} borderRadius={3} />
            <SkeletonBlock width={80} height={16} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Restaurant dining tables — 2-column grid cards */
export function KotTablesGridSkeleton({ count = 6 }: { count?: number }) {
  const theme = useAppTheme();
  const tileWidth = (screenWidth - 32 - 10) / 2;
  return (
    <View style={styles.kotTablesGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.kotTableTile, { width: tileWidth, backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
        >
          <View style={styles.rowBetween}>
            <SkeletonBlock width={36} height={36} borderRadius={10} />
            <SkeletonBlock width={20} height={20} borderRadius={6} />
          </View>
          <SkeletonBlock width="70%" height={14} borderRadius={4} style={{ marginTop: 10 }} />
          <SkeletonBlock width="50%" height={11} borderRadius={3} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/** KOT order detail — header strip, info card, item rows, settle button */
export function KotOrderDetailSkeleton() {
  const theme = useAppTheme();
  return (
    <View style={{ paddingTop: 4 }}>
      <View style={[styles.rowBetween, { marginBottom: 14 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <SkeletonBlock width={40} height={40} borderRadius={12} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <SkeletonBlock width={90} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="55%" height={18} borderRadius={5} />
          </View>
        </View>
        <SkeletonBlock width={88} height={34} borderRadius={10} />
      </View>
      <View style={[styles.chartCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <SkeletonBlock width="45%" height={16} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="60%" height={11} borderRadius={3} />
          </View>
          <SkeletonBlock width={72} height={22} borderRadius={8} />
        </View>
      </View>
      <View style={[styles.chartCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 12 }]}>
        <SkeletonBlock width={120} height={14} borderRadius={4} style={{ marginBottom: 10 }} />
        {[1, 2, 3, 4].map((row) => (
          <View key={row} style={[styles.rowBetween, { marginBottom: 10, paddingBottom: 8, borderBottomWidth: row < 4 ? 1 : 0, borderBottomColor: theme.borderColor }]}>
            <SkeletonBlock width="58%" height={12} borderRadius={3} />
            <SkeletonBlock width={56} height={12} borderRadius={3} />
          </View>
        ))}
        <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderColor }]}>
          <SkeletonBlock width={100} height={14} borderRadius={4} />
          <SkeletonBlock width={72} height={18} borderRadius={5} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={48} borderRadius={14} style={{ marginTop: 14 }} />
    </View>
  );
}

/** Customer ledger detail — profile, stat tiles, balance, transaction rows */
export function CustomerLedgerSkeleton() {
  const theme = useAppTheme();
  return (
    <View style={{ paddingTop: 4 }}>
      <View style={[styles.customerProfileCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
        <SkeletonBlock width={52} height={52} borderRadius={26} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonBlock width="55%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
          <SkeletonBlock width="40%" height={11} borderRadius={3} style={{ marginBottom: 4 }} />
          <SkeletonBlock width="65%" height={11} borderRadius={3} />
        </View>
        <SkeletonBlock width={36} height={36} borderRadius={18} />
      </View>
      <View style={styles.customerStatsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.customerStatTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <SkeletonBlock width={18} height={18} borderRadius={9} style={{ marginBottom: 6 }} />
            <SkeletonBlock width="70%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="80%" height={9} borderRadius={3} />
          </View>
        ))}
      </View>
      <View style={[styles.chartCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginTop: 12 }]}>
        <SkeletonBlock width={120} height={10} borderRadius={3} style={{ marginBottom: 6 }} />
        <SkeletonBlock width={100} height={24} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="75%" height={11} borderRadius={3} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 14 }}>
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width={(screenWidth - 48) / 3} height={36} borderRadius={10} />
        ))}
      </View>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.saleCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={{ flex: 1 }}>
            <SkeletonBlock width="50%" height={13} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="35%" height={10} borderRadius={3} />
          </View>
          <SkeletonBlock width={64} height={16} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

/** Feedback history cards */
export function FeedbackListSkeleton({ count = 3 }: { count?: number }) {
  const theme = useAppTheme();
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.feedbackCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.rowBetween}>
            <SkeletonBlock width={80} height={12} borderRadius={4} />
            <SkeletonBlock width={70} height={12} borderRadius={4} />
          </View>
          <SkeletonBlock width="95%" height={12} borderRadius={3} style={{ marginTop: 8 }} />
          <SkeletonBlock width="88%" height={12} borderRadius={3} style={{ marginTop: 4 }} />
          <SkeletonBlock width={60} height={10} borderRadius={3} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/** Credit reminder rows with action button */
export function RemindersListSkeleton({ count = 4 }: { count?: number }) {
  const theme = useAppTheme();
  return (
    <View>
      <SkeletonBlock width="100%" height={42} borderRadius={12} style={{ marginBottom: 10 }} />
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.reminderRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <SkeletonBlock width="45%" height={13} borderRadius={4} />
              <SkeletonBlock width={36} height={16} borderRadius={6} style={{ marginLeft: 8 }} />
            </View>
            <SkeletonBlock width="55%" height={10} borderRadius={3} />
          </View>
          <SkeletonBlock width={96} height={32} borderRadius={10} />
        </View>
      ))}
    </View>
  );
}

/** Category tree cards with parent header and subcategory rows */
export function CategoriesTreeSkeleton({ count = 3 }: { count?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ paddingTop: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.categoryTreeCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <SkeletonBlock width={36} height={36} borderRadius={10} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <SkeletonBlock width="50%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
                <SkeletonBlock width="70%" height={10} borderRadius={3} />
              </View>
            </View>
            <SkeletonBlock width={44} height={28} borderRadius={8} />
          </View>
          {[1, 2].map((sub) => (
            <View key={sub} style={[styles.categorySubRow, { borderTopColor: theme.borderColor }]}>
              <SkeletonBlock width={14} height={14} borderRadius={4} />
              <SkeletonBlock width="40%" height={12} borderRadius={3} style={{ marginLeft: 10, flex: 1 }} />
              <SkeletonBlock width={36} height={24} borderRadius={6} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Quick service token ticket rows */
export function QuickTokensListSkeleton({ count = 4 }: { count?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ paddingTop: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.tokenTicketCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <SkeletonBlock width={44} height={44} borderRadius={12} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <SkeletonBlock width="55%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="45%" height={10} borderRadius={3} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <SkeletonBlock width={56} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <SkeletonBlock width={28} height={28} borderRadius={8} />
              <SkeletonBlock width={28} height={28} borderRadius={8} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Expense transaction rows with colored icon box */
export function ExpensesListSkeleton({ count = 5 }: { count?: number }) {
  const theme = useAppTheme();
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.expenseCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <SkeletonBlock width={38} height={38} borderRadius={10} />
          <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
            <SkeletonBlock width="50%" height={13} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBlock width="65%" height={10} borderRadius={3} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <SkeletonBlock width={64} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <SkeletonBlock width={24} height={24} borderRadius={6} />
              <SkeletonBlock width={24} height={24} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Staff account cards with role badge */
export function StaffListSkeleton({ count = 4 }: { count?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ paddingTop: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.staffCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <SkeletonBlock width={40} height={40} borderRadius={20} style={{ marginRight: 10 }} />
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <SkeletonBlock width="40%" height={14} borderRadius={4} />
              <SkeletonBlock width={48} height={18} borderRadius={6} style={{ marginLeft: 8 }} />
            </View>
            <SkeletonBlock width="55%" height={10} borderRadius={3} style={{ marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <SkeletonBlock width={52} height={18} borderRadius={8} />
              <SkeletonBlock width={64} height={18} borderRadius={8} />
              <SkeletonBlock width={58} height={18} borderRadius={8} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SkeletonBlock width={32} height={32} borderRadius={8} />
            <SkeletonBlock width={32} height={32} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shimmerBand: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: 42,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tileBox: {
    width: (screenWidth - 32 - 24) / 4,
    height: 76,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  showMorePill: {
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: (screenWidth - 32 - 10) / 2,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  dualSectionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  halfCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  chartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    paddingHorizontal: 8,
  },
  productCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  posGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  posTile: {
    width: (screenWidth - 32 - 10) / 2,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  saleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchBox: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsBar: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  kotOrderCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  kotItemsPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  kotTablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 4,
  },
  kotTableTile: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 108,
  },
  customerProfileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  customerStatTile: {
    width: (screenWidth - 32 - 8) / 2,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  feedbackCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  reminderRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTreeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  categorySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
  },
  tokenTicketCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  expenseCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  staffCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
});
