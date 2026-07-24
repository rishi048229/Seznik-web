const RAW_API_URL = (import.meta.env.VITE_API_URL as string || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`;

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
