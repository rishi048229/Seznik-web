import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface OcrLine {
  text: string;
  confidence: number;
}

export interface OcrBlock {
  text: string;
  lines: OcrLine[];
}

export interface OfflineOcrResult {
  fullText: string;
  blocks: OcrBlock[];
  previewImageUri: string;
  pageCount?: number;
}

interface NativeOfflineBillOcr {
  isSupported(): boolean;
  recognizeFromImageUri(uriString: string): Promise<OfflineOcrResult>;
  recognizeFromPdfUri(uriString: string): Promise<OfflineOcrResult>;
}

let nativeModule: NativeOfflineBillOcr | null = null;
try {
  nativeModule = requireNativeModule<NativeOfflineBillOcr>('OfflineBillOcr');
} catch {
  nativeModule = null;
}

export function isOfflineOcrSupported(): boolean {
  return Platform.OS === 'android' && nativeModule !== null;
}

export async function recognizeBillFromImage(uri: string): Promise<OfflineOcrResult> {
  if (!nativeModule) {
    throw new Error('Offline Bill OCR is only available on Android native builds.');
  }
  return nativeModule.recognizeFromImageUri(uri);
}

export async function recognizeBillFromPdf(uri: string): Promise<OfflineOcrResult> {
  if (!nativeModule) {
    throw new Error('Offline Bill OCR is only available on Android native builds.');
  }
  return nativeModule.recognizeFromPdfUri(uri);
}

export default {
  isSupported: isOfflineOcrSupported,
  recognizeFromImage: recognizeBillFromImage,
  recognizeFromPdf: recognizeBillFromPdf,
};
