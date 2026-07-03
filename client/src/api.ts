import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qarta_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && location.pathname.startsWith('/admin')) {
      localStorage.removeItem('qarta_token');
      if (location.pathname !== '/admin/login') location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);
