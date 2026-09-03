import { create } from 'zustand';
import { Alert as RNAlert, AlertButton, AlertOptions } from 'react-native';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'destructive';

/** Strip emoji characters so alerts stay plain like native iOS dialogs. */
function stripEmojis(text: string): string {
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/gu,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface CustomAlertButton extends AlertButton {
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  type: AlertType;
  buttons: CustomAlertButton[];
  options?: AlertOptions;
  showAlert: (title: string, message?: string, buttons?: CustomAlertButton[], options?: AlertOptions) => void;
  hideAlert: () => void;
}

/**
 * Automatically infers the dialog tone/type from title or buttons.
 */
function inferAlertType(title: string, message?: string, buttons?: CustomAlertButton[]): AlertType {
  const combined = `${title} ${message || ''}`.toLowerCase();

  const hasDestructiveBtn = buttons?.some((b) => b.style === 'destructive');
  if (hasDestructiveBtn || combined.includes('delete') || combined.includes('cancel token') || combined.includes('cancel ticket')) {
    return 'destructive';
  }

  if (
    combined.includes('success') ||
    combined.includes('saved') ||
    combined.includes('printed') ||
    combined.includes('recorded') ||
    combined.includes('thank you')
  ) {
    return 'success';
  }

  if (
    combined.includes('error') ||
    combined.includes('failed') ||
    combined.includes('invalid') ||
    combined.includes('denied')
  ) {
    return 'error';
  }

  if (
    combined.includes('warning') ||
    combined.includes('required') ||
    combined.includes('missing') ||
    combined.includes('permission')
  ) {
    return 'warning';
  }

  return 'info';
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  type: 'info',
  buttons: [],
  options: undefined,

  showAlert: (title, message, buttons, options) => {
    const alertButtons: CustomAlertButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' as const }];

    const type = inferAlertType(title, message, alertButtons);
    const sanitizedMsg = message
      ? type === 'error' || type === 'destructive'
        ? sanitizeErrorMessage(message)
        : stripEmojis(message)
      : message;

    set({
      visible: true,
      title: stripEmojis(title),
      message: sanitizedMsg,
      type,
      buttons: alertButtons,
      options,
    });
  },

  hideAlert: () => {
    set({ visible: false });
  },
}));

let isInstalled = false;

/**
 * Seamlessly overrides React Native's default Alert.alert
 * so that every alert in the app automatically renders a plain iOS-style popup.
 */
export function installGlobalAlertInterceptor() {
  if (isInstalled) return;
  isInstalled = true;

  const originalAlert = RNAlert.alert;

  RNAlert.alert = (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    useAlertStore.getState().showAlert(title, message, buttons as CustomAlertButton[], options);
  };
}
