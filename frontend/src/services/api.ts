const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL as string;
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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || response.statusText || 'API Request Failed');
  }

  return data;
};
