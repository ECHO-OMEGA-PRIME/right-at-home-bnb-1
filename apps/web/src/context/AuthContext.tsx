'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  // Check for dev mode login from localStorage
  const checkDevModeLogin = useCallback(() => {
    if (typeof window === 'undefined') return false;

    const devMode = localStorage.getItem('dev_mode');
    const devUserJson = localStorage.getItem('dev_user');

    if (devMode === 'true' && devUserJson) {
      try {
        const devUser = JSON.parse(devUserJson);
        setAppUser({
          uid: devUser.uid,
          email: devUser.email,
          displayName: devUser.displayName,
          photoURL: devUser.photoURL || null,
          role: devUser.role,
          isOwner: devUser.isOwner || devUser.role === 'owner',
          isActiveWorker: devUser.isActiveWorker || devUser.role === 'worker',
          workerType: devUser.workerType,
          assignedProperties: devUser.properties || [],
          createdAt: devUser.createdAt,
          lastLogin: devUser.lastLogin,
        } as AppUser);
        setIsDevMode(true);
        return true;
      } catch (err) {
        console.error('Error parsing dev user:', err);
        localStorage.removeItem('dev_mode');
        localStorage.removeItem('dev_user');
      }
    }
    return false;
  }, []);

  // Load user data
  const loadUserData = useCallback(async () => {
    try {
      const userData = await getCurrentUser();
      setAppUser(userData);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    // First check for dev mode
    const devModeActive = checkDevModeLogin();

    if (devModeActive) {
      setLoading(false);
      return; // Skip Firebase auth for dev mode
    }

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadUserData();
      } else {
        // Check dev mode again if no firebase user
        if (!checkDevModeLogin()) {
          setAppUser(null);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserData, checkDevModeLogin]);

  // Sign in with Google
  const signInGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const userData = await signInWithGoogle();
      if (userData) {
        setAppUser(userData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Apple
  const signInApple = async () => {
    setError(null);
    setLoading(true);
    try {
      const userData = await signInWithApple();
      if (userData) {
        setAppUser(userData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Apple');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    setLoading(true);
    try {
      // Clear dev mode from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('dev_mode');
        localStorage.removeItem('dev_user');
        localStorage.removeItem('user_role');
      }
      setIsDevMode(false);

      // Sign out from Firebase if there's a user
      if (user) {
        await signOut();
      }
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
