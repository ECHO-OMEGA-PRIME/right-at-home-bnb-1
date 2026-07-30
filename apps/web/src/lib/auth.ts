'use client';

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  OAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  Firestore,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  getFirebaseClientConfig,
  getFirebaseClientConfigurationStatus,
} from '@/lib/firebase-client-config';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;

function canInitializeFirebase(): boolean {
  return (
    typeof window !== 'undefined' &&
    getFirebaseClientConfigurationStatus().configured
  );
}

function getFirebaseApp(): FirebaseApp {
  const config = getFirebaseClientConfig();

  if (firebaseApp) return firebaseApp;

  const existing = getApps()[0];
  if (existing) {
    if (existing.options.projectId !== config.projectId) {
      throw new Error(
        `Existing Firebase app uses project ${existing.options.projectId ?? 'unknown'}, ` +
          `but RAH requires ${config.projectId}.`,
      );
    }
    firebaseApp = existing;
  } else {
    firebaseApp = initializeApp(config);
  }

  return firebaseApp;
}

export function getAuthInstance(): Auth {
  if (!canInitializeFirebase()) {
    getFirebaseClientConfig();
    throw new Error('Firebase Auth is unavailable in this environment.');
  }
  if (!firebaseAuth) firebaseAuth = getAuth(getFirebaseApp());
  return firebaseAuth;
}

function getDbInstance(): Firestore {
  if (!canInitializeFirebase()) {
    getFirebaseClientConfig();
    throw new Error('Firestore is unavailable in this environment.');
  }
  if (!firestoreDb) firestoreDb = getFirestore(getFirebaseApp());
  return firestoreDb;
}

export const auth = {
  get currentUser() {
    try {
      return getAuthInstance().currentUser;
    } catch {
      return null;
    }
  },
};

export { getDbInstance as db };

export type UserRole = 'guest' | 'worker' | 'admin' | 'owner';

type LegacyWorkerRole =
  | 'cleaner'
  | 'maintenance'
  | 'yard_crew'
  | 'handyman'
  | 'both';

export const ROLE_PERMISSIONS = {
  owner: {
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
    canManageCleaningTasks: true,
    canViewMaintenance: true,
    canManageMaintenance: true,
    canViewReports: false,
    canAccessSettings: false,
    canManageUsers: false,
    canViewAIChat: false,
    canViewCalendar: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewSmartHome: false,
    canManageSmartHome: false,
    canViewVRBO: false,
    canManageVRBO: false,
  },
  guest: {
    canViewProperties: true,
    canManageProperties: false,
    canViewBookings: true,
    canManageBookings: true,
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
    canViewAIChat: true,
    canViewCalendar: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewSmartHome: false,
    canManageSmartHome: false,
    canViewVRBO: false,
    canManageVRBO: false,
  },
} as const;

export type Permission = keyof typeof ROLE_PERMISSIONS.owner;

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  properties?: string[];
  assignedProperties?: string[];
  phone?: string;
  createdAt: Date;
  lastLogin: Date;
  isActiveWorker?: boolean;
  workerType?: 'cleaner' | 'maintenance' | 'both';
  hourlyRate?: number;
  isOwner?: boolean;
  isDeveloper?: boolean;
}

const OWNER_EMAILS = [
  'steven@rah-midland.com',
  'spalma@rah-midland.com',
] as const;

export const ADMIN_EMAILS = [
  ...OWNER_EMAILS,
  'bobmcwilliams4@outlook.com',
  'bobmcwilliams4@gmail.com',
] as const;

function normalizeRole(value: unknown): UserRole {
  if (value === 'owner' || value === 'admin' || value === 'worker' || value === 'guest') {
    return value;
  }
  if (
    value === 'cleaner' ||
    value === 'maintenance' ||
    value === 'yard_crew' ||
    value === 'handyman' ||
    value === 'both'
  ) {
    return 'worker';
  }
  return 'guest';
}

function toDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const converter = (value as { toDate?: () => Date }).toDate;
    if (typeof converter === 'function') return converter.call(value);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function appUserFromData(user: User, data: Record<string, unknown>): AppUser {
  const role = normalizeRole(data.role);
  const workerTypeValue = data.workerType ?? data.staffType;
  const workerType =
    workerTypeValue === 'cleaner' ||
    workerTypeValue === 'maintenance' ||
    workerTypeValue === 'both'
      ? workerTypeValue
      : undefined;

  return {
    uid: user.uid,
    email: user.email ?? (typeof data.email === 'string' ? data.email : null),
    displayName:
      user.displayName ??
      (typeof data.displayName === 'string' ? data.displayName : null),
    photoURL: user.photoURL ?? (typeof data.photoURL === 'string' ? data.photoURL : null),
    role,
    properties: Array.isArray(data.properties)
      ? data.properties.filter((item): item is string => typeof item === 'string')
      : [],
    assignedProperties: Array.isArray(data.assignedProperties)
      ? data.assignedProperties.filter((item): item is string => typeof item === 'string')
      : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    createdAt: toDate(data.createdAt),
    lastLogin: toDate(data.lastLogin),
    isActiveWorker: role === 'worker' ? data.isActiveWorker !== false : false,
    workerType,
    hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : undefined,
    isOwner: role === 'owner' || data.isOwner === true,
    isDeveloper: data.isDeveloper === true,
  };
}

function determineUserRole(email: string | null): UserRole {
  if (!email) return 'guest';
  const normalizedEmail = email.toLowerCase();
  if (OWNER_EMAILS.some((candidate) => candidate === normalizedEmail)) return 'owner';
  if (ADMIN_EMAILS.some((candidate) => candidate === normalizedEmail)) return 'admin';
  return 'guest';
}

export function hasPermission(user: AppUser | null, permission: Permission): boolean {
  const role = user?.role ?? 'guest';
  return ROLE_PERMISSIONS[role][permission];
}

export function canAccessRoute(user: AppUser | null, route: string): boolean {
  const publicExactRoutes = new Set([
    '/',
    '/properties',
    '/login',
    '/register',
    '/privacy-policy',
    '/terms-of-service',
    '/booking/success',
    '/booking/complete',
    '/booking/cancelled',
  ]);

  if (publicExactRoutes.has(route)) return true;
  if (/^\/properties\/[^/]+\/?$/.test(route) && route !== '/properties/new') return true;
  if (!user) return false;

  const routePermissions: Array<[string, Permission]> = [
    ['/admin', 'canAccessSettings'],
    ['/owner', 'canAccessSettings'],
    ['/properties/new', 'canManageProperties'],
    ['/financials', 'canViewFinancials'],
    ['/workers', 'canViewWorkers'],
    ['/cleaning', 'canViewCleaningTasks'],
    ['/maintenance', 'canViewMaintenance'],
    ['/inventory', 'canViewInventory'],
    ['/calendar', 'canViewCalendar'],
    ['/smart-home', 'canViewSmartHome'],
    ['/reports', 'canViewReports'],
    ['/vrbo', 'canViewVRBO'],
    ['/guests', 'canViewGuests'],
    ['/settings', 'canAccessSettings'],
  ];

  const match = routePermissions.find(
    ([prefix]) => route === prefix || route.startsWith(`${prefix}/`),
  );
  return match ? hasPermission(user, match[1]) : true;
}

let googleProvider: GoogleAuthProvider | null = null;
let appleProvider: OAuthProvider | null = null;

function getGoogleProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
  }
  return googleProvider;
}

function getAppleProvider(): OAuthProvider {
  if (!appleProvider) {
    appleProvider = new OAuthProvider('apple.com');
    appleProvider.addScope('email');
    appleProvider.addScope('name');
  }
  return appleProvider;
}

async function createOrUpdateUser(user: User): Promise<AppUser> {
  const dbInstance = getDbInstance();
  const userRef = doc(dbInstance, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);

  if (userSnapshot.exists()) {
    const existing = userSnapshot.data() as Record<string, unknown>;
    await setDoc(
      userRef,
      {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );
    return appUserFromData(user, { ...existing, lastLogin: new Date() });
  }

  const role = determineUserRole(user.email);
  const now = new Date();
  const newUser = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role,
    properties: [],
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    isOwner: role === 'owner',
    isDeveloper: role === 'admin',
  };

  await setDoc(userRef, newUser);
  return appUserFromData(user, { ...newUser, createdAt: now, lastLogin: now });
}

export async function signInWithGoogle(): Promise<AppUser | null> {
  const result = await signInWithPopup(getAuthInstance(), getGoogleProvider());
  return createOrUpdateUser(result.user);
}

export async function signInWithApple(): Promise<AppUser | null> {
  const result = await signInWithPopup(getAuthInstance(), getAppleProvider());
  return createOrUpdateUser(result.user);
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AppUser | null> {
  const result = await signInWithEmailAndPassword(getAuthInstance(), email, password);
  return createOrUpdateUser(result.user);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuthInstance());
}

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const currentUser = getAuthInstance().currentUser;
    if (!currentUser) return null;
    const userSnapshot = await getDoc(doc(getDbInstance(), 'users', currentUser.uid));
    return userSnapshot.exists()
      ? appUserFromData(currentUser, userSnapshot.data() as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  try {
    return onAuthStateChanged(getAuthInstance(), callback);
  } catch {
    queueMicrotask(() => callback(null));
    return () => undefined;
  }
}

export async function isOwner(uid: string): Promise<boolean> {
  try {
    const userSnapshot = await getDoc(doc(getDbInstance(), 'users', uid));
    if (!userSnapshot.exists()) return false;
    const role = normalizeRole(userSnapshot.data().role);
    return role === 'owner' || role === 'admin';
  } catch {
    return false;
  }
}

export async function promoteToOwner(
  uid: string,
  propertyIds: string[] = [],
): Promise<void> {
  await setDoc(
    doc(getDbInstance(), 'users', uid),
    { role: 'owner', isOwner: true, properties: propertyIds },
    { merge: true },
  );
}


/** Legacy worker-role values retained for migration and reconciliation tooling. */
export type StoredWorkerRole = LegacyWorkerRole;
