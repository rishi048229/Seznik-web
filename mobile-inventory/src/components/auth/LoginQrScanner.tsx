import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Flashlight, FlashlightOff, QrCode, X } from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';
import { parseQrLoginCode } from '@/utils/qrLogin';
import { useTranslation } from '@/store/useLanguageStore';

interface LoginQrScannerProps {
  visible: boolean;
  onClose: () => void;
  onCodeScanned: (code: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function LoginQrScanner({
  visible,
  onClose,
  onCodeScanned,
  isSubmitting = false,
}: LoginQrScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const lastRawRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      busyRef.current = false;
      lastRawRef.current = null;
      setScanError(null);
      setTorchOn(false);
      return;
    }
    if (Platform.OS !== 'web' && permission && !permission.granted) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!visible || busyRef.current || isSubmitting) return;
      const raw = String(data || '').trim();
      if (!raw || raw === lastRawRef.current) return;
      lastRawRef.current = raw;

      const code = parseQrLoginCode(raw);
      if (!code) {
        setScanError(t('qrLoginNotSeznik', 'This is not a Seznik login QR. Scan the code on your web dashboard.'));
        return;
      }

      busyRef.current = true;
      setScanError(null);
      try {
        await onCodeScanned(code);
      } catch (err: unknown) {
        busyRef.current = false;
        lastRawRef.current = null;
        const message =
          err instanceof Error ? err.message : t('qrLoginFailed', 'Could not sign in with this QR code.');
        setScanError(message);
      }
    },
    [visible, isSubmitting, onCodeScanned, t]
  );

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SafeAreaView edges={['top']} style={styles.toolbar}>
          <View style={styles.titleRow}>
            <QrCode size={18} color="#93C5FD" />
            <Text style={styles.titleText}>{t('scanDashboardQr', 'Scan dashboard QR')}</Text>
          </View>
          <View style={styles.toolbarActions}>
            {Platform.OS !== 'web' ? (
              <TouchableOpacity
                onPress={() => setTorchOn((prev) => !prev)}
                style={[styles.toolBtn, torchOn && styles.toolBtnActive]}
              >
                {torchOn ? <Flashlight size={16} color="#000" /> : <FlashlightOff size={16} color="#FFF" />}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              style={[styles.toolBtn, styles.closeBtn]}
            >
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View style={styles.cameraWrap}>
          {Platform.OS === 'web' ? (
            <View style={styles.fallback}>
              <QrCode size={40} color="#93C5FD" />
              <Text style={styles.fallbackTitle}>{t('qrLoginWebUnavailable', 'Use the phone app')}</Text>
              <Text style={styles.fallbackBody}>
                {t(
                  'qrLoginWebUnavailableSub',
                  'QR login scanning works on the iOS and Android Seznik app. Open this screen on your phone.'
                )}
              </Text>
            </View>
          ) : !permission?.granted ? (
            <View style={styles.fallback}>
              <Text style={styles.fallbackTitle}>{t('cameraPermissionNeeded', 'Camera permission needed')}</Text>
              <Text style={styles.fallbackBody}>
                {t('qrLoginCameraPermission', 'Allow camera access to scan the login QR from your dashboard.')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  void requestPermission().then((result) => {
                    if (!result.granted) {
                      Alert.alert(
                        t('permissionRequired', 'Permission Required'),
                        t('qrLoginCameraPermission', 'Allow camera access to scan the login QR from your dashboard.')
                      );
                    }
                  });
                }}
                style={styles.permissionBtn}
              >
                <Text style={styles.permissionBtnText}>{t('enableCamera', 'Enable camera')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchOn}
                onBarcodeScanned={handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              <View style={styles.reticleOverlay} pointerEvents="none">
                <View style={styles.reticleFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.hint}>
                  {t('qrLoginHint', 'Point the camera at the QR on your web dashboard')}
                </Text>
              </View>
            </>
          )}

          {(isSubmitting || scanError) && (
            <View style={[styles.banner, scanError ? styles.bannerError : styles.bannerInfo]}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} /> : null}
              <Text style={styles.bannerText} numberOfLines={3}>
                {isSubmitting ? t('signingIn', 'Signing In...') : scanError}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CORNER = 22;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: '#F59E0B' },
  closeBtn: { backgroundColor: 'rgba(239, 68, 68, 0.85)' },
  cameraWrap: { flex: 1, position: 'relative' },
  reticleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#93C5FD',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  hint: {
    marginTop: 18,
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  fallbackTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  fallbackBody: { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  permissionBtn: {
    marginTop: 12,
    backgroundColor: BRAND_COLORS.blue600,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  permissionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerInfo: { backgroundColor: 'rgba(37, 99, 235, 0.95)' },
  bannerError: { backgroundColor: 'rgba(239, 68, 68, 0.95)' },
  bannerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1 },
});
