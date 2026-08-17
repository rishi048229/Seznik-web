import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

interface BarcodeViewProps {
  barcode: string;
  width?: number;
  height?: number;
  showText?: boolean;
}

export function BarcodeView({
  barcode,
  width = 240,
  height = 70,
  showText = true,
}: BarcodeViewProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Helper to generate a deterministic binary barcode pattern (1 = line, 0 = space)
  const getBarcodeBinaryPattern = (code: string): string => {
    // EAN-13 lookalike structure
    let pattern = '101'; // start guard
    const cleanCode = code.replace(/[^0-9]/g, '');

    // Ensure we have a string of numbers (fallback if empty)
    const dataString = cleanCode || '2010000000000';

    // digit pattern mappings
    const digitPatterns = [
      '0001101', // 0
      '0011001', // 1
      '0010011', // 2
      '0111101', // 3
      '0100011', // 4
      '0110001', // 5
      '0101111', // 6
      '0111011', // 7
      '0110111', // 8
      '0001011', // 9
    ];

    for (let i = 0; i < Math.min(12, dataString.length); i++) {
      const num = parseInt(dataString[i], 10);
      pattern += digitPatterns[num];

      if (i === 5) {
        pattern += '01010'; // middle guard
      }
    }

    pattern += '101'; // end guard
    return pattern;
  };

  const binaryPattern = getBarcodeBinaryPattern(barcode);
  const totalModules = binaryPattern.length;

  const barHeight = showText ? height - 20 : height;
  const moduleWidth = width / totalModules;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Draw background */}
        <Rect x="0" y="0" width={width} height={height} fill={colors.surface} />

        {/* Draw bars */}
        {binaryPattern.split('').map((char, index) => {
          if (char === '1') {
            return (
              <Rect
                key={index}
                x={index * moduleWidth}
                y={10}
                width={moduleWidth + 0.1} // overlap slightly to prevent rendering thin gaps
                height={barHeight}
                fill={colors.text}
              />
            );
          }
          return null;
        })}
      </Svg>
      {showText && (
        <Text style={[styles.barcodeText, { color: colors.textSecondary }]}>
          {barcode}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  barcodeText: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 3,
    fontWeight: '700',
  },
});
