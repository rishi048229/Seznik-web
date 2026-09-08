import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { BusinessType } from '@/constants/businessTypes';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface BusinessTypeIconProps {
  type: BusinessType;
  selected?: boolean;
  size?: number;
  showContainer?: boolean;
}

export const BusinessTypeIcon: React.FC<BusinessTypeIconProps> = ({
  type,
  selected = false,
  size = 22,
  showContainer = true,
}) => {
  const theme = useAppTheme();
  const iconColor = selected
    ? '#FFFFFF'
    : theme.isDark
      ? '#E2E8F0'
      : '#334155';

  const renderSvg = () => {
    switch (type) {
      case 'restaurant_cafe':
        return (
          <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={iconColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Dining Cutlery */}
            <Path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
            <Path d="M15 2v6" />
            <Path d="M15 11v11" />
            <Path d="M5 2v8a3 3 0 0 0 3 3h1v9" />
            <Path d="M5 2c2 0 4 1.8 4 4.5V10" />
          </Svg>
        );

      case 'online_store':
        return (
          <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={iconColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* E-Commerce Shopping Bag with Digital Sparkle */}
            <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <Path d="M3 6h18" />
            <Path d="M16 10a4 4 0 0 1-8 0" />
            <Circle cx={12} cy={15} r={1.5} fill={iconColor} stroke="none" />
            <Path d="M9.5 15h-.5m6 0h-.5" />
          </Svg>
        );

      case 'retail_shop':
      default:
        return (
          <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={iconColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Retail Storefront with Awning & Door */}
            <Path d="M3 9 5 3h14l2 6" />
            <Path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
            <Path d="M10 21v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
          </Svg>
        );
    }
  };

  if (!showContainer) {
    return <View style={styles.rawContainer}>{renderSvg()}</View>;
  }

  return (
    <View
      style={[
        styles.iconContainer,
        {
          backgroundColor: selected
            ? BRAND_COLORS.blue600
            : theme.isDark
              ? '#27272A'
              : '#F1F5F9',
          borderColor: selected
            ? BRAND_COLORS.blue600
            : theme.borderColor,
        },
      ]}
    >
      {renderSvg()}
    </View>
  );
};

const styles = StyleSheet.create({
  rawContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
