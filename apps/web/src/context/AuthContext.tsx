'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signInWithApple,
  signOut,
  getCurrentUser,
  onAuthChange,
  AppUser,
} from '@/lib/auth';

function setAuthCookie(token: string) {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 30;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `rah-auth-token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Strict${secure}`;
}

function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `rah-auth-token=; path=/; max-age=0; SameSite=Strict${secure}`;
}

function clearDevState() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('dev_mode');
  localStorage.removeItem('dev_user');
  localStorage.removeItem('user_role');
  localStorage.removeItem('worker_type');
}

function devLoginEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === 'true';
}

function isDevCookiePresent(): boolean {
  if (typeof document === 'undefined') return false;
  const row = document.cookie
    .split('; ')
    .find((item) => item.startsWith('rah-auth-token='));
  if (!row) return false;
  const value = decodeURIComponent(row.slice('rah-auth-token='.length));
  return value.startsWith('dev_') || value.startsWith('dev-mode-');
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  error: string | null;
  signInGoogle: () => Promise<void>;
  signInApple: () => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
  isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  const checkDevModeLogin = useCallback(() => {
    if (typeof window === 'undefined') return false;

    if (!devLoginEnabled()) {
      clearDevState();
      if (isDevCookiePresent()) clearAuthCookie();
      setIsDevMode(false);
      return false;
    }

    const devMode = localStorage.getItem('dev_mode');
    const devUserJson = localStorage.getItem('dev_user');
    if (devMode !== 'true' || !devUserJson) return false;

    try {
      const devUser = JSON.parse(devUserJson);
      const validRoles = new Set(['guest', 'worker', 'admin', 'owner']);
      if (!devUser?.uid || !validRoles.has(devUser.role)) throw new Error('Invalid development user');

      setAppUser({
        uid: devUser.uid,
        email: devUser.email,
        displayName: devUser.displayName,
        photoURL: devUser.photoURL || null,
        role: devUser.role,
        isOwner: devUser.role === 'owner' || devUser.role === 'admin',
        isActiveWorker: devUser.role === 'worker',
        workerType: devUser.workerType,
        assignedProperties: devUser.properties || [],
        createdAt: devUser.createdAt,
        lastLogin: devUser.lastLogin,
      } as AppUser);
      setIsDevMode(true);
      setAuthCookie(`dev-mode-${devUser.uid}`);
      return true;
    } catch (err) {
      console.error('Invalid development auth state:', err);
      clearDevState();
      if (isDevCookiePresent()) clearAuthCookie();
      setIsDevMode(false);
      return false;
    }
  }, []);

  const loadUserData = useCallback(async () => {
    try {
      const userData = await getCurrentUser();
      setAppUser(userData);
    } catch (err) {
      console.error('Error loading user data:', err);
      setAppUser(null);
    }
  }, []);

  useEffect(() => {
    if (checkDevModeLogin()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setAuthCookie(token);
        await loadUserData();
      } else {
        setAppUser(null);
        setIsDevMode(false);
        if (isDevCookiePresent()) clearAuthCookie();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [checkDevModeLogin, loadUserData]);

  const signInGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const userData = await signInWithGoogle();
      if (userData) setAppUser(userData);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInApple = async () => {
    setError(null);
    setLoading(true);
    try {
      const userData = await signInWithApple();
      if (userData) setAppUser(userData);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Apple');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      clearDevState();
      clearAuthCookie();
      setIsDevMode(false);
      if (user) await signOut();
      setUser(null);
      setAppUser(null);
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    appUser,
    loading,
    error,
    signInGoogle,
    signInApple,
    logout,
    signOut: logout,
    isOwner: appUser?.role === 'owner' || appUser?.role === 'admin',
    isAdmin: appUser?.role === 'admin',
    isDevMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
