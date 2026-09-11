import React, { useState, useEffect } from 'react';
import { Image, ImageStyle, StyleProp, DimensionValue } from 'react-native';
import type { ReceiptSizeChip, ThermalPaper } from '@shared/receiptPrintGeometry';
import { rasterizeReceiptLogoForPrint } from '@/utils/receiptLogoRaster';

export interface ThermalReceiptLogoImageProps {
  uri: string;
  paperWidth?: ThermalPaper;
  widthPercent?: number;
  logoSizeChip?: ReceiptSizeChip;
  style?: StyleProp<ImageStyle>;
  maxWidth?: number;
  maxHeight?: number;
  width?: DimensionValue;
  height?: number;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}

export const ThermalReceiptLogoImage: React.FC<ThermalReceiptLogoImageProps> = ({
  uri,
  paperWidth = '58mm',
  widthPercent = 60,
  logoSizeChip = 'medium',
  style,
  maxWidth,
  maxHeight,
  width,
  height,
  resizeMode = 'contain',
}) => {
  const [rasterUri, setRasterUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!uri) {
      setRasterUri(null);
      return;
    }

    rasterizeReceiptLogoForPrint(uri, paperWidth, widthPercent, logoSizeChip)
      .then((res) => {
        if (active && res?.base64) {
          setRasterUri(`data:image/png;base64,${res.base64}`);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [uri, paperWidth, widthPercent, logoSizeChip]);

  return (
    <Image
      source={{ uri: rasterUri || uri }}
      style={[
        style,
        maxWidth !== undefined && { maxWidth },
        maxHeight !== undefined && { maxHeight },
        width !== undefined && { width },
        height !== undefined && { height },
        { resizeMode },
      ]}
    />
  );
};
