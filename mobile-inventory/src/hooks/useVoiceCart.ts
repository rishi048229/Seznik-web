import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { parseVoiceCommandBest, ParsedVoiceCommand, VoiceProductRef } from '@/utils/voiceCommandParser';

export interface VoiceCartFeedback {
  ok: boolean;
  message: string;
}

/**
 * BCP-47 locales for the on-device recognizer. "en-IN" is the recommended default — it's what
 * actually produced the Latin-script Hinglish transcripts ("teen bread", "nariyal tel") this parser
 * is tuned for. hi-IN/gu-IN/mr-IN ask the recognizer for that language specifically, which on most
 * devices returns native-script text (Devanagari/Gujarati) — since this app's product names are
 * typically typed in Latin/Hinglish, native-script transcripts generally won't string-match them.
 * They're offered because recognizer quality varies by device/OS build, not because they're
 * guaranteed to match better — worth letting the user try if en-IN keeps mishearing them.
 */
export const VOICE_LANGUAGES: { code: string; label: string; short: string }[] = [
  { code: 'en-IN', label: 'English/Hinglish', short: 'EN' },
  { code: 'hi-IN', label: 'Hindi', short: 'HI' },
  { code: 'gu-IN', label: 'Gujarati', short: 'GU' },
  { code: 'mr-IN', label: 'Marathi', short: 'MR' },
];

interface UseVoiceCartOptions {
  products: VoiceProductRef[];
  onCommand: (cmd: ParsedVoiceCommand) => void;
  /** BCP-47 recognizer locale, e.g. "en-IN" (default), "hi-IN", "gu-IN", "mr-IN". */
  lang?: string;
}

/**
 * "2 bread" / "add two bread" / "remove 2 breads" -> cart edits, via on-device speech recognition.
 * Toggle-to-listen: continuous:true keeps the mic open across multiple spoken commands until the
 * user taps to stop, rather than requiring a fresh tap per item (matches the requested flow of
 * saying several items in a row while filling a bill).
 */
export function useVoiceCart({ products, onCommand, lang = 'en-IN' }: UseVoiceCartOptions) {
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<VoiceCartFeedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs so the native event listeners (registered once by useSpeechRecognitionEvent) always see
  // the latest product list / cart handler / language without forcing a listener re-subscribe on
  // every render. Updated in an effect (not during render) — mutating a ref while rendering is
  // flagged by react-hooks/refs even for this "latest ref" idiom, since the mutation is a side effect.
  const productsRef = useRef(products);
  const onCommandRef = useRef(onCommand);
  const langRef = useRef(lang);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // True only when the native module actually linked into this build (config-plugin rebuild) —
  // false in Expo Go or a dev client built before this feature was added, same pattern as
  // ThermalPrinterService.isNativeModuleAvailable().
  const isAvailable = typeof ExpoSpeechRecognitionModule?.start === 'function';

  const showFeedback = useCallback((ok: boolean, message: string) => {
    setFeedback({ ok, message });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2800);
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal || !event.results?.length) return;
    // The recognizer returns several ranked alternative transcriptions per utterance, not just one —
    // the top guess is often NOT the one that matches a real product (e.g. "aata" heard as "atta" in
    // alternative #1 but correctly as "aata" in #2). Try every alternative, keep the first real match.
    const transcripts = event.results.map((r) => r.transcript?.trim()).filter(Boolean) as string[];
    if (!transcripts.length) return;

    const parsed = parseVoiceCommandBest(transcripts, productsRef.current);
    if (parsed.action === 'unknown' || !parsed.matchedProduct) {
      showFeedback(false, `Couldn't match a product in "${transcripts[0]}"`);
      return;
    }

    onCommandRef.current(parsed);
    const qtyLabel = parsed.quantity === Infinity ? 'all' : parsed.quantity;
    showFeedback(true, `${parsed.action === 'add' ? 'Added' : 'Removed'} ${qtyLabel}x ${parsed.matchedProduct.name}`);
  });

  useSpeechRecognitionEvent('error', (event) => {
    // "no-speech"/"aborted" fire routinely on silence or a deliberate stop() — not real failures.
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    setIsListening(false);
    showFeedback(false, event.message || 'Voice recognition error');
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  const start = useCallback(async () => {
    if (!isAvailable) {
      showFeedback(false, 'Voice input needs an updated app build (dev client rebuild).');
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        showFeedback(false, 'Microphone/speech permission denied. Enable it in phone Settings.');
        return;
      }
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: langRef.current,
        interimResults: false,
        continuous: true,
        // Ask for every alternative the recognizer supports so parseVoiceCommandBest has real
        // options to try instead of being stuck with just the single top (often mis-heard) guess.
        maxAlternatives: 5,
        // Biases the recognizer toward this store's actual product names, so e.g. "bread" doesn't
        // get misheard as an unrelated word — the store catalog is the most relevant vocabulary here.
        contextualStrings: productsRef.current.map((p) => p.name).slice(0, 100),
      });
    } catch (err: any) {
      setIsListening(false);
      showFeedback(false, err?.message || 'Could not start voice input.');
    }
  }, [isAvailable, showFeedback]);

  const stop = useCallback(() => {
    if (!isAvailable) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // no-op — stop() on an already-inactive recognizer is harmless
    }
    setIsListening(false);
  }, [isAvailable]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      // Stop any in-flight recognition on unmount so the mic doesn't stay hot after navigating away.
      if (isAvailable) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // no-op
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isListening, feedback, toggle, isAvailable };
}
