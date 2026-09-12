import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { getAuthToken, removeAuthToken, removeStoredUser } from '@/services/secureStore';
import { useAuthStore } from '@/store/useAuthStore';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

// Environment Configurable Base URLs
const PROD_DEFAULT_API_URL = 'http://54.175.133.69:5000/api';
const DEFAULT_PORT = (
  process.env.EXPO_PUBLIC_API_PORT ||
  process.env.EXPO_PUBLIC_PORT ||
  '5001'
).trim();

const getDynamicHostIp = () => {
  // 1. Explicit Full API URL from environment (EAS build, .env, or production config)
  if (process.env.EXPO_PUBLIC_API_URL) {
    let url = process.env.EXPO_PUBLIC_API_URL.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url.endsWith('/api') ? url : `${url.replace(/\/$/, '')}/api`;
  }

  // 2. NativeModules.SourceCode.scriptURL (auto-detects Metro host IP on physical devices)
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL && typeof scriptURL === 'string') {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:${DEFAULT_PORT}/api`;
      }
    }
  } catch {}

  // 3. Dynamic Host IP auto-detected from Expo bundler (laptop Wi-Fi IP)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest?.hostUri ||
    (Constants as any).experienceUrl;

  if (hostUri && typeof hostUri === 'string') {
    const cleanUri = hostUri.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
    const ip = cleanUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:${DEFAULT_PORT}/api`;
    }
  }

  // 4. In standalone production builds, ALWAYS default to the cloud production API!
  if (!__DEV__) {
    return PROD_DEFAULT_API_URL;
  }

  // 5. Explicit Host from env during local dev (e.g. EXPO_PUBLIC_API_HOST="192.168.0.111")
  const envHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
  if (envHost) {
    return `http://${envHost}:${DEFAULT_PORT}/api`;
  }

  // 6. Android Emulator loopback alias for host machine
  if (Platform.OS === 'android' && !Constants.isDevice) {
    return `http://10.0.2.2:${DEFAULT_PORT}/api`;
  }

  // 7. Default to cloud backend so even dev devices work if local backend isn't running
  return PROD_DEFAULT_API_URL;
};

let currentBaseUrl = getDynamicHostIp();

if (__DEV__) {
  console.log('📡 [Seznik API Client] Active API Base URL:', currentBaseUrl);
}

export const getApiBaseUrl = () => currentBaseUrl;

/** Re-detect Metro/LAN host — call when connectivity fails or app returns to foreground. */
export const refreshApiBaseUrl = (): string => {
  const next = getDynamicHostIp();
  if (next !== currentBaseUrl) {
    currentBaseUrl = next;
    if (__DEV__) {
      console.log('📡 [Seznik API Client] Refreshed API Base URL:', currentBaseUrl);
    }
  }
  return currentBaseUrl;
};

export const setApiBaseUrl = (url: string) => {
  let formatted = url.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `http://${formatted}`;
  }
  if (!formatted.endsWith('/api')) {
    formatted = formatted.replace(/\/$/, '') + '/api';
  }
  currentBaseUrl = formatted;
  if (__DEV__) {
    console.log('📡 [Seznik API Client] Updated API Base URL:', currentBaseUrl);
  }
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const storedToken = await getAuthToken();
  const token = storedToken || useAuthStore.getState().token || undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-platform': 'mobile',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const executeRequest = async (baseUrl: string): Promise<T> => {
    const fullUrl = `${baseUrl}${cleanEndpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(fullUrl, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          await removeAuthToken();
          await removeStoredUser();
        }
        const rawErrorMessage = data.error || data.message || `HTTP ${response.status} error`;
        const sanitized = sanitizeErrorMessage(rawErrorMessage);
        throw new ApiError(sanitized, response.status, data);
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancel')) {
        throw new ApiError(
          'The request timed out. Please verify your connection and try again.',
          0
        );
      }
      throw new ApiError(
        'Unable to connect to the server. Please check your internet connection.',
        0
      );
    }
  };

  try {
    return await executeRequest(currentBaseUrl);
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      const previous = currentBaseUrl;
      refreshApiBaseUrl();
      if (currentBaseUrl !== previous) {
        return await executeRequest(currentBaseUrl);
      }
    }
    throw error;
  }
}
