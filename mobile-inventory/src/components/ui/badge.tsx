import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  useColorScheme,
} from 'react-native';
import { Colors } from '@/constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  textTransform?: TextStyle['textTransform'];
}

export function Badge({
  label,
  variant = 'neutral',
  style,
  textStyle,
  textTransform = 'none',
}: BadgeProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const getStyles = () => {
    let backgroundColor: string = colors.backgroundElement;
    let textColor: string = colors.textSecondary;

    switch (variant) {
      case 'primary':
        backgroundColor = `${colors.primary}15`;
        textColor = colors.primary;
        break;
      case 'success':
        backgroundColor = `${colors.success}15`;
        textColor = colors.success;
        break;
      case 'warning':
        backgroundColor = `${colors.warning}15`;
        textColor = colors.warning;
        break;
      case 'danger':
        backgroundColor = `${colors.danger}15`;
        textColor = colors.danger;
        break;
      case 'neutral':
        backgroundColor = colors.backgroundElement;
        textColor = colors.textSecondary;
        break;
    }

    return { 
      container: { backgroundColor }, 
      text: { color: textColor, textTransform } 
    };
  };

  const preset = getStyles();

  return (
    <View style={[styles.container, preset.container, style]}>
      <Text style={[styles.text, preset.text, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
