import { useColorScheme } from 'react-native';
import { BRAND_COLORS } from '@/constants/theme';

export interface AppTheme {
  isDark: boolean;
  bg: string;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

/**
 * Single shared source of truth for screen-level theming, replacing the
 * `const theme = isDark ? {...} : {...}` block that used to be duplicated in every screen.
 * `bg` is a plain solid color (dark slate in dark mode, light slate in light mode) — pass it to
 * <ScreenBackground color={theme.bg}> to wrap a screen.
 */
export function useAppTheme(): AppTheme {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return isDark
    ? {
        isDark,
        bg: BRAND_COLORS.slate950,
        cardBg: BRAND_COLORS.slate800,
        borderColor: BRAND_COLORS.slate700,
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
      }
    : {
        isDark,
        bg: BRAND_COLORS.slate50,
        cardBg: '#FFFFFF',
        borderColor: BRAND_COLORS.slate200,
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
      };
}
