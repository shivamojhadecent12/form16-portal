import { api } from './api';
import type { AuthUser, LoginCredentials } from '@/types';

export async function loginAdmin(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post('/auth/login/admin', { email, password });
  
  // Store token and user
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('auth_user', JSON.stringify(data.user));
  
  return data.user;
}

export async function loginEmployee(pan: string, name: string): Promise<AuthUser> {
  const { data } = await api.post('/auth/login/employee', { pan, name });
  
  // Store token and user
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('auth_user', JSON.stringify(data.user));
  
  return data.user;
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  if (credentials.email && credentials.password) {
    return loginAdmin(credentials.email, credentials.password);
  } else if (credentials.pan && credentials.name) {
    return loginEmployee(credentials.pan, credentials.name);
  } else {
    throw new Error('Invalid credentials');
  }
}

export async function logout(): Promise<void> {
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_token');
}

export function getStoredUser(): AuthUser | null {
  const stored = localStorage.getItem('auth_user');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem('auth_user', JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_token');
}
