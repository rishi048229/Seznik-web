import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';


import { QueryClient, QueryClientProvider, QueryCache, MutationCache, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { hydrateAndPrefetchAppData } from '@/services/prefetchAppData';
import { installGlobalAlertInterceptor } from '@/store/useAlertStore';
import { CustomAlertModal } from '@/components/ui/CustomAlertModal';
import '@/global.css';
import { enableFreeze } from 'react-native-screens';

// Keep inactive tab screens frozen so cart/theme/query updates don't re-render every tab.
enableFreeze(true);

// Intercept all Alert.alert calls across the app to render custom themed modal
installGlobalAlertInterceptor();

SplashScreen.preventAutoHideAsync();

// App-wide fallback so a query/mutation failure is never silently swallowed, even on a screen
// that hasn't (yet) wired up its own isError/ScreenErrorState handling — this is a safety net,
// not a replacement for per-screen error UI.
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[QueryCache] query ${JSON.stringify(query.queryKey)} failed:`, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error(`[MutationCache] mutation ${JSON.stringify(mutation.options.mutationKey) || '(unnamed)'} failed:`, error);
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes fresh data
      gcTime: 1000 * 60 * 30, // 30 minutes in-memory cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
    },
  },
});

import { AppSplashScreen } from '@/components/ui/AppSplashScreen';
import { usePrinterStore } from '@/store/usePrinterStore';

function AppDataPrefetcher() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId) return;
    hydrateAndPrefetchAppData(queryClient, userId).catch((err) => {
      console.error('[AppDataPrefetcher] startup prefetch failed:', err);
    });
  }, [isLoading, isAuthenticated, userId, queryClient]);

  return null;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initializeAuth();
    usePrinterStore.getState().hydrateFromSettings().catch(() => {});
  }, []);

  // Mounted at the root, for the whole app lifetime, because every screen gates printing on
  // connectionState. Subscribing from a screen instead means printer drops go unnoticed whenever
  // that screen isn't mounted, and the UI keeps reporting "Ready" for a printer that is switched off.
  useEffect(() => {
    const unsubscribe = usePrinterStore.getState().initListener();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      usePrinterStore.getState().hydrateFromSettings().catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }

    SplashScreen.hideAsync().catch(() => {});
  }, [isLoading, isAuthenticated, segments]);

  if (isLoading) {
    return <AppSplashScreen />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppDataPrefetcher />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 220,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(auth)/forgot-password" />
        <Stack.Screen name="index" />
      </Stack>
      {/* Global custom themed alert popup matching app design system */}
      <CustomAlertModal />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    // Required by react-native-gesture-handler v2 — any GestureDetector anywhere in the tree
    // (e.g. Label Studio's drag/resize canvas) throws "must be used as a descendant of
    // GestureHandlerRootView" at runtime without this, which is what was crashing that screen.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
