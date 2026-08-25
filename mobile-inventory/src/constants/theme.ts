/**
 * Seznik POS Brand Identity Design System Tokens
 * - Primary UI Chrome / Buttons: Dark-navy ink (#0a0a2e)
 * - Secondary Accent: Blue-to-sky gradient (#2563eb -> #38bdf8)
 * - Rounded-xl cards & soft shadows
 */

export const BRAND_COLORS = {
  navyInk: '#0a0a2e',
  navyInkHover: '#121245',
  blue600: '#2563eb',
  sky400: '#38bdf8',
  sky500: '#0284c7',
  sky600: '#0369a1',
  emerald500: '#10b981',
  amber500: '#f59e0b',
  rose500: '#f43f5e',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate400: '#94a3b8',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#090d16',
};

export const MaxContentWidth = 1200;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_700Bold',
};

export const Colors = {
  light: {
    text: '#0f172a',
    subText: '#64748b',
    textSecondary: '#64748b',
    background: '#f8fafc',
    backgroundSelected: 'rgba(37, 99, 235, 0.12)',
    backgroundElement: '#f1f5f9',
    card: '#ffffff',
    surface: '#ffffff',
    border: '#e2e8f0',
    primary: '#0a0a2e',
    accent: '#2563eb',
    tint: '#0284c7',
    danger: '#ef4444',
    neutral: '#64748b',
    success: '#10b981',
    warning: '#f59e0b',
    tabIconDefault: '#64748b',
    tabIconSelected: '#0284c7',
  },
  dark: {
    text: '#f8fafc',
    subText: '#94a3b8',
    textSecondary: '#94a3b8',
    background: '#090d16',
    backgroundSelected: 'rgba(56, 189, 248, 0.15)',
    backgroundElement: '#1e293b',
    card: '#1e293b',
    surface: '#1e293b',
    border: '#334155',
    primary: '#0a0a2e',
    accent: '#38bdf8',
    tint: '#38bdf8',
    danger: '#ef4444',
    neutral: '#94a3b8',
    success: '#10b981',
    warning: '#f59e0b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: '#38bdf8',
  },
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
