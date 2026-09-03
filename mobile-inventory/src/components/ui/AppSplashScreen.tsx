import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  StatusBar,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { BRAND_COLORS } from '@/constants/theme';

interface AppSplashScreenProps {
  onFinish?: () => void;
}

export function AppSplashScreen({ onFinish }: AppSplashScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onFinish) {
        onFinish();
      }
    });
  }, [fadeAnim, scaleAnim, textFadeAnim, onFinish]);

  const bgColor = isDark ? '#000000' : '#F8FAFC';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? '#A1A1AA' : '#64748B';
  const logoWrapperBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF';
  const logoBorderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />

      <View style={styles.centerBox}>
        {/* Animated Logo Container */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              backgroundColor: logoWrapperBg,
              borderColor: logoBorderColor,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={
              isDark
                ? require('../../../assets/images/seznik_white_logo.png')
                : require('../../../assets/images/seznik_logo.png')
            }
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Text & Tagline */}
        <Animated.View style={[styles.textBox, { opacity: textFadeAnim }]}>
          <Text style={[styles.brandTitle, { color: textColor }]}>
            Seznik <Text style={{ color: BRAND_COLORS.blue600 }}>POS</Text>
          </Text>
          <Text style={[styles.brandTagline, { color: subtitleColor }]}>
            Smart Cloud Billing & Retail Management
          </Text>
        </Animated.View>

        {/* Loading Spinner */}
        <View style={styles.spinnerBox}>
          <ActivityIndicator size="small" color={BRAND_COLORS.blue600} />
        </View>
      </View>

      {/* Footer Version */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(100, 116, 139, 0.7)' }]}>
          SECURE CLOUD POS • v1.0.0
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoWrapper: {
    width: 104,
    height: 104,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: BRAND_COLORS.blue600,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  logoImage: {
    width: 74,
    height: 74,
  },
  textBox: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  spinnerBox: {
    marginTop: 28,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
