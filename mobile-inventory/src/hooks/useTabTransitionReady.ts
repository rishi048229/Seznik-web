import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useIsFocused } from 'expo-router';

/**
 * Defers heavy tab body content until after the tab transition animation completes.
 * Once ready, stays mounted so returning to the tab stays instant.
 */
export function useTabTransitionReady() {
  const isFocused = useIsFocused();
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    if (!isFocused || contentReady) return;

    const handle = InteractionManager.runAfterInteractions(() => {
      setContentReady(true);
    });

    return () => handle.cancel();
  }, [isFocused, contentReady]);

  return { isFocused, contentReady };
}
