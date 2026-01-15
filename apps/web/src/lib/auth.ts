'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, Firestore } from 'firebase/firestore';

// Firebase Configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'echo-prime-ai.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'echo-prime-ai',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'echo-prime-ai.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '249995513427',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase can be initialized (has valid API key and in browser)
const canInitFirebase = typeof window !== 'undefined' && firebaseConfig.apiKey;

// Lazy initialization - only init when actually used
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getApp(): FirebaseApp {
  if (!canInitFirebase) {
    throw new Error('Firebase cannot be initialized (missing API key or not in browser)');
  }
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

// Export getters that lazily initialize
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!canInitFirebase) return undefined;
    if (!_auth) _auth = getAuth(getApp());
    return (_auth as any)[prop];
  },
});

export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!canInitFirebase) return undefined;
    if (!_db) _db = getFirestore(getApp());
    return (_db as any)[prop];
  },
});

// Providers - lazily initialized
let _googleProvider: GoogleAuthProvider | null = null;
let _appleProvider: OAuthProvider | null = null;

function getGoogleProvider(): GoogleAuthProvider {
  if (!_googleProvider) {
    _googleProvider = new GoogleAuthProvider();
    _googleProvider.addScope('email');
    _googleProvider.addScope('profile');
  }
  return _googleProvider;
}

function getAppleProvider(): OAuthProvider {
  if (!_appleProvider) {
    _appleProvider = new OAuthProvider('apple.com');
    _appleProvider.addScope('email');
    _appleProvider.addScope('name');
  }
  return _appleProvider;
}

// User roles
export type UserRole = 'guest' | 'owner' | 'admin';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  properties?: string[];
  createdAt: Date;
  lastLogin: Date;
}

// Sign in with Google
export async function signInWithGoogle(): Promise<AppUser | null> {
  if (!canInitFirebase) {
    throw new Error('Firebase not available');
  }
  try {
    if (!_auth) _auth = getAuth(getApp());
    const result = await signInWithPopup(_auth, getGoogleProvider());
    const user = result.user;

    // Create/update user document
    const appUser = await createOrUpdateUser(user);
    return appUser;
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

// Sign in with Apple
export async function signInWithApple(): Promise<AppUser | null> {
  if (!canInitFirebase) {
    throw new Error('Firebase not available');
  }
  try {
    if (!_auth) _auth = getAuth(getApp());
    const result = await signInWithPopup(_auth, getAppleProvider());
    const user = result.user;

    // Create/update user document
    const appUser = await createOrUpdateUser(user);
    return appUser;
  } catch (error: any) {
    console.error('Apple sign-in error:', error);
    throw error;
  }
}

// Create or update user document in Firestore
async function createOrUpdateUser(user: User): Promise<AppUser> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    // Update last login
    await setDoc(userRef, {
      lastLogin: serverTimestamp(),
    }, { merge: true });

    return userSnap.data() as AppUser;
  } else {
    // Create new user
    const newUser: Omit<AppUser, 'createdAt' | 'lastLogin'> & { createdAt: any; lastLogin: any } = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: 'guest',
      properties: [],
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    };

    await setDoc(userRef, newUser);
    return { ...newUser, createdAt: new Date(), lastLogin: new Date() } as AppUser;
  }
}

// Sign out
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Get current user with role
export async function getCurrentUser(): Promise<AppUser | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as AppUser;
  }

  return null;
}

// Auth state listener
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Check if user is owner
export async function isOwner(uid: string): Promise<boolean> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data() as AppUser;
    return userData.role === 'owner' || userData.role === 'admin';
  }

  return false;
}

// Promote user to owner
export async function promoteToOwner(uid: string, propertyIds: string[] = []): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    role: 'owner',
    properties: propertyIds,
  }, { merge: true });
}
