import React from 'react';
import { KeyboardAvoidingView, Platform, ViewStyle } from 'react-native';

/**
 * Thin wrapper around `KeyboardAvoidingView`, with two Android behaviors depending on context:
 *
 * - Plain screen content (not inside a RN `<Modal>`): no explicit behavior — Android's own
 *   `windowSoftInputMode="adjustResize"` (Expo's default) already resizes the view; stacking
 *   `"height"` on top of that double-shrinks the layout.
 * - Inside a `<Modal>` (`inModal` prop): `<Modal>` renders on its own native surface/window on
 *   Android that does *not* inherit the Activity's `adjustResize` behavior, so `adjustResize`
 *   alone never avoids the keyboard for Modal-based bottom sheets — `behavior="height"` is
 *   required there to actively resize based on the measured keyboard height via JS.
 *
 * Pass `inModal` for every `KeyboardAvoidingWrapper` that sits directly inside a `<Modal>`
 * (bottom sheets, dialogs) — omit it for wrappers around a screen's own top-level content.
 */
export function KeyboardAvoidingWrapper({
  children,
  style,
  keyboardVerticalOffset,
  inModal = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Extra offset for iOS / Android */
  keyboardVerticalOffset?: number;
  /** Set true when this wrapper sits directly inside a <Modal> — see behavior notes above. */
  inModal?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : inModal ? 'height' : 'padding'}
      keyboardVerticalOffset={keyboardVerticalOffset ?? (Platform.OS === 'ios' ? 0 : inModal ? 0 : 20)}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
