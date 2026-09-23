import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { useColorScheme, View, ActivityIndicator, Text, TextInput, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import {
  useFonts,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';

// Industrial ERP Typography: Set default font to IBM Plex Sans across the entire application
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.style = { fontFamily: 'IBMPlexSans_400Regular' };

if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.style = { fontFamily: 'IBMPlexSans_400Regular' };

import { QueryClient, QueryClientProvider, QueryCache, MutationCache, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { hydrateAndPrefetchAppData } from '@/services/prefetchAppData';
import { refreshApiBaseUrl } from '@/api/client';
import { installGlobalAlertInterceptor } from '@/store/useAlertStore';
import { CustomAlertModal } from '@/components/ui/CustomAlertModal';
import '@/global.css';
import { enableFreeze } from 'react-native-screens';

const PureBlackDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#121212',
    border: '#262626',
    text: '#ffffff',
  },
};

// Keep inactive tab screens frozen so cart/theme/query updates don't re-render every tab.
enableFreeze(true);

// Intercept all Alert.alert calls across the app to render iOS-style system popup
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
import { useNotificationStore } from '@/store/useNotificationStore';
import {
  subscribeToNotificationResponses,
  handleNotificationNavigation,
} from '@/services/notificationService';
import { registerPushTokenWithBackend } from '@/services/pushRegistration';
import { IncomingPrintRequestBanner } from '@/components/printers/IncomingPrintRequestBanner';


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
  const { isAuthenticated, isLoading, initializeAuth, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    refreshApiBaseUrl();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshApiBaseUrl();
        if (useAuthStore.getState().isAuthenticated) {
          registerPushTokenWithBackend().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    initializeAuth();
    usePrinterStore.getState().hydrateFromSettings().catch(() => {});
    useNotificationStore.getState().hydrate().catch(() => {});

    // Listen to notification clicks and route user directly to the target screen
    const unsubNotifs = subscribeToNotificationResponses((data) => {
      handleNotificationNavigation(data, router);
    });

    // Guarantee splash dismiss within 600ms on all devices
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 600);
    return () => {
      clearTimeout(timer);
      unsubNotifs();
    };
  }, [router]);

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
      // Registers this device's Expo push token so it can actually receive pushes (Remote Print
      // requests, low-stock alerts, etc.) — must run on every login, not just once ever, since a
      // fresh install or a different account on the same phone needs its own registration.
      registerPushTokenWithBackend().catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    // The workstation chooser lives in the (auth) group but is a signed-in screen: you pick Admin
    // or Agent *after* authenticating. Without this exemption the redirect below threw every
    // authenticated user straight back to the tabs, which made both the post-login step and the
    // sidebar's "Switch Workstation / Role" impossible to reach.
    const onAccessSelection = segments[0] === '(auth)' && segments[1] === 'access-selection';
    const inAuthGroup = segments[0] === '(auth)' && !onAccessSelection;
    const onOnboarding = segments[0] === 'onboarding';
    const isManagedUser = user?.accountType === 'managed' || Boolean((user as any)?.adminId);
    const needsOnboarding =
      isAuthenticated &&
      !isManagedUser &&
      user?.onboardingCompleted === false;
    const needsBusinessType =
      isAuthenticated &&
      !isManagedUser &&
      user?.onboardingCompleted !== false &&
      !user?.businessType;
    const needsSetup = needsOnboarding || needsBusinessType;

    if (!isAuthenticated && !inAuthGroup && !onAccessSelection) {
      router.replace('/(auth)/login' as any);
    } else if (isAuthenticated && isManagedUser && onOnboarding) {
      router.replace('/(tabs)' as any);
    } else if (isAuthenticated && needsSetup && !onOnboarding) {
      router.replace('/onboarding' as any);
    } else if (isAuthenticated && (inAuthGroup || onOnboarding) && !needsSetup) {
      // Managed (agent) sessions may open access-selection to switch back to Store Admin.
      if (onAccessSelection) return;
      router.replace('/(tabs)' as any);
    }

    SplashScreen.hideAsync().catch(() => {});
  }, [isLoading, isAuthenticated, segments, user?.onboardingCompleted, user?.accountType, user?.role, user?.businessType]);

  if (isLoading) {
    return <AppSplashScreen />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? PureBlackDarkTheme : DefaultTheme}>
      <AppDataPrefetcher />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(auth)/forgot-password" />
        <Stack.Screen name="onboarding/index" />
      </Stack>
      {/* Global custom themed alert popup matching app design system */}
      <CustomAlertModal />
      {/* Surfaces an incoming remote print request from any screen, in case the push didn't land */}
      {isAuthenticated && <IncomingPrintRequestBanner />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  const [fontTimeoutPassed, setFontTimeoutPassed] = React.useState(false);

  useEffect(() => {
    // Safety net: If fonts take longer than 2.5s to load on older Android devices, proceed anyway
    const timer = setTimeout(() => {
      setFontTimeoutPassed(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded && !fontError && !fontTimeoutPassed) {
    return <AppSplashScreen />;
  }

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
