import { create } from 'zustand';
import type { AuthUser } from '@/types';
import { getStoredUser, storeUser, clearStoredUser } from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => {
    if (user) {
      storeUser(user);
      set({ user, isAuthenticated: true });
    } else {
      clearStoredUser();
      set({ user: null, isAuthenticated: false });
    }
  },
  logout: () => {
    clearStoredUser();
    set({ user: null, isAuthenticated: false });
  },
  initialize: () => {
    const user = getStoredUser();
    if (user) {
      set({ user, isAuthenticated: true });
    }
  },
}));
