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
  isOwner: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadUserData();
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserData]);

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
      await signOut();
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
    isOwner: appUser?.role === 'owner' || appUser?.role === 'admin',
    isAdmin: appUser?.role === 'admin',
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
