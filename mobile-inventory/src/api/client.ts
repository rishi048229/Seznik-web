import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { getAuthToken, removeAuthToken, removeStoredUser } from '@/services/secureStore';
import { useAuthStore } from '@/store/useAuthStore';

// Environment Configurable Base URLs
const PROD_DEFAULT_API_URL = 'https://api.seznik.com/api';
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

  // 2. Explicit Host from env (e.g. EXPO_PUBLIC_API_HOST="192.168.1.22")
  const envHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
  if (envHost) {
    return `http://${envHost}:${DEFAULT_PORT}/api`;
  }

  // 3. NativeModules.SourceCode.scriptURL (has Metro host IP on physical devices)
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL && typeof scriptURL === 'string') {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:${DEFAULT_PORT}/api`;
      }
    }
  } catch {}

  // 4. Dynamic Host IP auto-detected from Expo bundler (laptop Wi-Fi IP)
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

  // 5. If running on a physical device, fallback to the local LAN Wi-Fi machine IP
  if (Constants.isDevice) {
    return `http://192.168.1.22:${DEFAULT_PORT}/api`;
  }

  // 6. Android Emulator loopback alias for host machine
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}/api`;
  }

  // 7. Default localhost fallback
  return `http://localhost:${DEFAULT_PORT}/api`;
};

let currentBaseUrl = getDynamicHostIp();

if (__DEV__) {
  console.log('📡 [Seznik API Client] Active API Base URL:', currentBaseUrl);
}

export const getApiBaseUrl = () => currentBaseUrl;

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
  }
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const storedToken = await getAuthToken();
  const token = storedToken || useAuthStore.getState().token || (__DEV__ ? 'dev-token-bypass' : undefined);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-platform': 'mobile',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${currentBaseUrl}${cleanEndpoint}`;

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
      if (response.status === 401 && !__DEV__) {
        await removeAuthToken();
        await removeStoredUser();
      }
      const errorMessage = data.error || data.message || `HTTP ${response.status} error`;
      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancel')) {
      throw new ApiError(
        `Request timed out. Server at ${currentBaseUrl} took too long to respond.`,
        0
      );
    }
    throw new ApiError(
      `Cannot connect to backend server (${currentBaseUrl}). Ensure backend is running and reachable on port ${DEFAULT_PORT}.`,
      0
    );
  }
}
