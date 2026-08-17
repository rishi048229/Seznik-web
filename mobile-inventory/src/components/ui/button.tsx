import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  useColorScheme,
} from 'react-native';
import { Colors } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const getStyles = () => {
    const baseStyle: ViewStyle = {};
    const textStylePreset: TextStyle = {};

    switch (variant) {
      case 'primary':
        baseStyle.backgroundColor = colors.primary;
        textStylePreset.color = '#FFFFFF';
        break;
      case 'secondary':
        baseStyle.backgroundColor = colors.backgroundElement;
        textStylePreset.color = colors.text;
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = colors.border;
        textStylePreset.color = colors.text;
        break;
      case 'ghost':
        baseStyle.backgroundColor = 'transparent';
        textStylePreset.color = colors.primary;
        break;
      case 'destructive':
        baseStyle.backgroundColor = colors.danger;
        textStylePreset.color = '#FFFFFF';
        break;
    }

    if (disabled) {
      baseStyle.opacity = 0.5;
    }

    return { button: baseStyle, text: textStylePreset };
  };

  const preset = getStyles();

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        preset.button,
        style,
        pressed && !disabled && !loading && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : colors.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, preset.text, textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
