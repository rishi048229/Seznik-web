import React, { useEffect, useRef } from 'react';
import {
  Animated,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertOctagon, AlertTriangle, Package, X, PlusCircle } from 'lucide-react-native';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useAppTheme } from '@/hooks/useAppTheme';

export function InAppNotificationBanner() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const activeBanner = useNotificationStore((state) => state.activeBanner);
  const dismissBanner = useNotificationStore((state) => state.dismissBanner);
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeBanner) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 6000);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activeBanner]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissBanner();
    });
  };

  if (!activeBanner) return null;

  const isCritical = activeBanner.severity === 'critical' || activeBanner.type === 'out_of_stock';
  const isUrgent = activeBanner.severity === 'urgent' || activeBanner.type === 'critical_stock';

  const bgColor = isCritical
    ? (theme.isDark ? '#3B1212' : '#FEF2F2')
    : isUrgent
    ? (theme.isDark ? '#3B2A12' : '#FFFBEB')
    : (theme.isDark ? '#1E293B' : '#FFFFFF');

  const borderColor = isCritical ? '#EF4444' : isUrgent ? '#F59E0B' : '#3B82F6';

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 24 : 12);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topInset + 4,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bannerCard,
          {
            backgroundColor: bgColor,
            borderColor,
          },
        ]}
      >
        <View style={styles.contentRow}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isCritical
                  ? 'rgba(239, 68, 68, 0.15)'
                  : isUrgent
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(59, 130, 246, 0.15)',
              },
            ]}
          >
            {isCritical ? (
              <AlertOctagon size={20} color="#EF4444" />
            ) : isUrgent ? (
              <AlertTriangle size={20} color="#F59E0B" />
            ) : (
              <Package size={20} color="#3B82F6" />
            )}
          </View>

          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
              {activeBanner.title}
            </Text>
            <Text style={[styles.message, { color: theme.textPrimary }]} numberOfLines={2}>
              {activeBanner.message}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99999,
    elevation: 9999,
  },
  bannerCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
