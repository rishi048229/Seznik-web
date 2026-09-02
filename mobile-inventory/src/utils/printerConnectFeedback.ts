import { Vibration } from 'react-native';

let lastFeedbackAt = 0;
const FEEDBACK_COOLDOWN_MS = 1200;

/** One short haptic when a printer link is established. Cooldown prevents stacked buzzes. */
export function playPrinterConnectFeedback(): void {
  const now = Date.now();
  if (now - lastFeedbackAt < FEEDBACK_COOLDOWN_MS) return;
  lastFeedbackAt = now;
  try {
    Vibration.vibrate(40);
  } catch {
    // Vibration is optional on some platforms/builds.
  }
}
