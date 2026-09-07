import { useState, useEffect, useCallback } from 'react';
import { getStoredJoshDualModeTipCount, setStoredJoshDualModeTipCount } from '@/services/secureStore';

const MAX_TIP_SHOW_COUNT = 2;

export function useJoshDualModeTip() {
  const [tipCount, setTipCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const count = await getStoredJoshDualModeTipCount();
        if (mounted) {
          setTipCount(count);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const markTipShown = useCallback(async () => {
    const next = tipCount + 1;
    setTipCount(next);
    await setStoredJoshDualModeTipCount(next);
  }, [tipCount]);

  const dismissPermanently = useCallback(async () => {
    setTipCount(999);
    await setStoredJoshDualModeTipCount(999);
  }, []);

  const shouldShowTip = !isLoading && tipCount < MAX_TIP_SHOW_COUNT;

  return {
    shouldShowTip,
    tipCount,
    isLoading,
    markTipShown,
    dismissPermanently,
  };
}
