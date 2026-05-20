'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
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
const canInitFirebase = (): boolean => typeof window !== 'undefined' && !!firebaseConfig.apiKey;

// Lazy initialization - only init when actually used
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getApp(): FirebaseApp {
  if (!canInitFirebase()) {
    throw new Error('Firebase cannot be initialized (missing API key or not in browser)');
  }
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

// Function to get Auth instance (lazy init)
function getAuthInstance(): Auth {
  if (!canInitFirebase()) {
    throw new Error('Firebase Auth not available');
  }
  if (!_auth) {
    _auth = getAuth(getApp());
  }
  return _auth;
}

// Function to get Firestore instance (lazy init)
function getDbInstance(): Firestore {
  if (!canInitFirebase()) {
    throw new Error('Firestore not available');
  }
  if (!_db) {
    _db = getFirestore(getApp());
  }
  return _db;
}

// Export auth for backward compatibility - use getAuthInstance() in new code
export const auth = {
  get currentUser() {
    try {
      return getAuthInstance().currentUser;
    } catch {
      return null;
    }
  },
};

// Export db getter for modules that need Firestore access
export { getDbInstance as db };

// Export getAuthInstance for modules that need full Auth access
export { getAuthInstance };

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

// User roles - Four distinct access levels
export type UserRole = 'guest' | 'worker' | 'admin' | 'owner';

// Role permissions matrix
export const ROLE_PERMISSIONS = {
  owner: {
    // Full access for Steven (property owner)
    canViewProperties: true,
    canManageProperties: true,
    canViewBookings: true,
    canManageBookings: true,
    canViewFinancials: true,
    canManageFinancials: true,
    canViewWorkers: true,
    canManageWorkers: true,
    canViewGuests: true,
    canManageGuests: true,
    canViewCleaningTasks: true,
    canManageCleaningTasks: true,
    canViewMaintenance: true,
    canManageMaintenance: true,
    canViewReports: true,
    canAccessSettings: true,
    canManageUsers: true,
    canViewAIChat: true,
    canViewCalendar: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewSmartHome: true,
    canManageSmartHome: true,
    canViewVRBO: true,
    canManageVRBO: true,
  },
  admin: {
    // Full access for developers
    canViewProperties: true,
    canManageProperties: true,
    canViewBookings: true,
    canManageBookings: true,
    canViewFinancials: true,
    canManageFinancials: true,
    canViewWorkers: true,
    canManageWorkers: true,
    canViewGuests: true,
    canManageGuests: true,
    canViewCleaningTasks: true,
    canManageCleaningTasks: true,
    canViewMaintenance: true,
    canManageMaintenance: true,
    canViewReports: true,
    canAccessSettings: true,
    canManageUsers: true,
    canViewAIChat: true,
    canViewCalendar: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewSmartHome: true,
    canManageSmartHome: true,
    canViewVRBO: true,
    canManageVRBO: true,
  },
  worker: {
    // Limited access for cleaners and maintenance workers
    canViewProperties: true,
    canManageProperties: false,
    canViewBookings: false,
    canManageBookings: false,
    canViewFinancials: false,
    canManageFinancials: false,
    canViewWorkers: false,
    canManageWorkers: false,
    canViewGuests: false,
    canManageGuests: false,
    canViewCleaningTasks: true,
    canManageCleaningTasks: true, // Can update their own tasks
    canViewMaintenance: true,
    canManageMaintenance: true, // Can update their own tasks
    canViewReports: false,
    canAccessSettings: false,
    canManageUsers: false,
    canViewAIChat: false,
    canViewCalendar: true, // View cleaning schedule
    canViewInventory: true, // Check/update supplies
    canManageInventory: true,
    canViewSmartHome: false,
    canManageSmartHome: false,
    canViewVRBO: false,
    canManageVRBO: false,
  },
  guest: {
    // Public/guest access - properties, reviews, bookings only
    canViewProperties: true,
    canManageProperties: false,
    canViewBookings: true, // Their own bookings only
    canManageBookings: true, // Can make/cancel their own
    canViewFinancials: false,
    canManageFinancials: false,
    canViewWorkers: false,
    canManageWorkers: false,
    canViewGuests: false,
    canManageGuests: false,
    canViewCleaningTasks: false,
    canManageCleaningTasks: false,
    canViewMaintenance: false,
    canManageMaintenance: false,
    canViewReports: false,
    canAccessSettings: false,
    canManageUsers: false,
    canViewAIChat: true, // AI Concierge access
    canViewCalendar: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewSmartHome: false,
    canManageSmartHome: false,
    canViewVRBO: false,
    canManageVRBO: false,
  },
} as const;

export type Permission = keyof typeof ROLE_PERMISSIONS.admin;

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  properties?: string[]; // For workers: assigned properties
  phone?: string;
  createdAt: Date;
  lastLogin: Date;
  // Worker-specific fields
  isActiveWorker?: boolean;
  workerType?: 'cleaner' | 'maintenance' | 'both';
  hourlyRate?: number;
  // Admin-specific fields
  isOwner?: boolean; // Steven Palma
  isDeveloper?: boolean; // Developer access
}

// Admin emails for automatic role assignment
export const ADMIN_EMAILS = [
  'steven@rah-midland.com',
  'spalma@rah-midland.com',
  'bobmcwilliams4@outlook.com', // Developer
  'bobmcwilliams4@gmail.com', // Developer
];

// Check if user has specific permission
export function hasPermission(user: AppUser | null, permission: Permission): boolean {
  if (!user) return ROLE_PERMISSIONS.guest[permission];
  return ROLE_PERMISSIONS[user.role]?.[permission] ?? false;
}

// Check if user can access route
export function canAccessRoute(user: AppUser | null, route: string): boolean {
  // Public routes
  const publicRoutes = ['/', '/properties', '/login', '/register'];
  if (publicRoutes.some(r => route === r || route.startsWith(r + '/'))) {
    return true;
  }

  if (!user) return false;

  // Route-based access control
  const routePermissions: Record<string, Permission[]> = {
    '/admin': ['canAccessSettings'],
    '/dashboard': ['canViewBookings'],
    '/financials': ['canViewFinancials'],
    '/workers': ['canViewWorkers'],
    '/cleaning': ['canViewCleaningTasks'],
    '/maintenance': ['canViewMaintenance'],
    '/inventory': ['canViewInventory'],
    '/calendar': ['canViewCalendar'],
    '/smart-home': ['canViewSmartHome'],
    '/reports': ['canViewReports'],
    '/vrbo': ['canViewVRBO'],
    '/guests': ['canViewGuests'],
    '/settings': ['canAccessSettings'],
  };

  for (const [routePrefix, permissions] of Object.entries(routePermissions)) {
    if (route.startsWith(routePrefix)) {
      return permissions.every(p => hasPermission(user, p));
    }
  }

  return true; // Allow by default for unlisted routes
}

// Sign in with Google
export async function signInWithGoogle(): Promise<AppUser | null> {
  if (!canInitFirebase()) {
    throw new Error('Firebase not available');
  }
  try {
    const authInstance = getAuthInstance();
    const result = await signInWithPopup(authInstance, getGoogleProvider());
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
  if (!canInitFirebase()) {
    throw new Error('Firebase not available');
  }
  try {
    const authInstance = getAuthInstance();
    const result = await signInWithPopup(authInstance, getAppleProvider());
    const user = result.user;

    // Create/update user document
    const appUser = await createOrUpdateUser(user);
    return appUser;
  } catch (error: any) {
    console.error('Apple sign-in error:', error);
    throw error;
  }
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string): Promise<AppUser | null> {
  if (!canInitFirebase()) {
    throw new Error('Firebase not available');
  }
  try {
    const authInstance = getAuthInstance();
    const result = await signInWithEmailAndPassword(authInstance, email, password);
    const user = result.user;

    // Create/update user document
    const appUser = await createOrUpdateUser(user);
    return appUser;
  } catch (error: any) {
    console.error('Email sign-in error:', error);
    throw error;
  }
}

// Determine role based on email
function determineUserRole(email: string | null): UserRole {
  if (!email) return 'guest';
  const emailLower = email.toLowerCase();

  // Check for admin emails
  if (ADMIN_EMAILS.some(e => e.toLowerCase() === emailLower)) {
    return 'admin';
  }

  // Check for worker emails (can be expanded or stored in DB)
  if (emailLower.includes('cleaner') || emailLower.includes('worker') || emailLower.includes('maintenance')) {
    return 'worker';
  }

  return 'guest';
}

// Create or update user document in Firestore
async function createOrUpdateUser(user: User): Promise<AppUser> {
  const dbInstance = getDbInstance();
  const userRef = doc(dbInstance, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    // Update last login
    await setDoc(userRef, {
      lastLogin: serverTimestamp(),
    }, { merge: true });

    return userSnap.data() as AppUser;
  } else {
    // Create new user with auto-assigned role
    const autoRole = determineUserRole(user.email);
    const isOwnerEmail = user.email?.toLowerCase().includes('steven') ||
                         user.email?.toLowerCase().includes('spalma');
    const isDeveloperEmail = user.email?.toLowerCase().includes('bobmcwilliams');

    const newUser: Omit<AppUser, 'createdAt' | 'lastLogin'> & { createdAt: any; lastLogin: any } = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: autoRole,
      properties: [],
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      isOwner: isOwnerEmail,
      isDeveloper: isDeveloperEmail,
    };

    await setDoc(userRef, newUser);
    return { ...newUser, createdAt: new Date(), lastLogin: new Date() } as AppUser;
  }
}

// Sign out
export async function signOut(): Promise<void> {
  try {
    const authInstance = getAuthInstance();
    await firebaseSignOut(authInstance);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Get current user with role
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const authInstance = getAuthInstance();
    const user = authInstance.currentUser;
    if (!user) return null;

    const dbInstance = getDbInstance();
    const userRef = doc(dbInstance, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as AppUser;
    }

    return null;
  } catch {
    return null;
  }
}

// Auth state listener
export function onAuthChange(callback: (user: User | null) => void): () => void {
  try {
    const authInstance = getAuthInstance();
    return onAuthStateChanged(authInstance, callback);
  } catch {
    // Return no-op unsubscribe if Firebase not available
    return () => {};
  }
}

// Check if user is owner
export async function isOwner(uid: string): Promise<boolean> {
  try {
    const dbInstance = getDbInstance();
    const userRef = doc(dbInstance, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as AppUser;
      return userData.role === 'owner' || userData.role === 'admin';
    }

    return false;
  } catch {
    return false;
  }
}

// Promote user to owner
export async function promoteToOwner(uid: string, propertyIds: string[] = []): Promise<void> {
  const dbInstance = getDbInstance();
  const userRef = doc(dbInstance, 'users', uid);
  await setDoc(userRef, {
    role: 'owner',
    properties: propertyIds,
  }, { merge: true });
}
