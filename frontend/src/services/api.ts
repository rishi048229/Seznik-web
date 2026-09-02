import { toUserMessage } from '@/utils/userMessage'

const getApiUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL as string || '').trim();
  // If running on HTTPS (like Vercel) and VITE_API_URL is HTTP (EC2 IP), force /api proxy to bypass browser Mixed Content blocks
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && envUrl.startsWith('http://')) {
    return '/api';
  }
  if (!envUrl) return '/api';
  const raw = envUrl.replace(/\/$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
};

const API_URL = getApiUrl();

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token: string) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response: Response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new Error(toUserMessage(err, 'Check your internet connection and try again.'))
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const fallback =
      response.status === 401
        ? 'Please sign in again.'
        : response.status === 403
          ? 'You do not have permission to do that.'
          : response.status === 404
            ? 'We could not find that record.'
            : 'Something went wrong. Please try again.'
    throw new Error(toUserMessage(data?.error || response.statusText, fallback))
  }

  return data;
};
