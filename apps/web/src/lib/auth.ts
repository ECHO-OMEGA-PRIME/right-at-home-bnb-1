'use client';

import { setAuthCookie } from '@/lib/auth-cookie';
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
  getFirebaseClientConfig,
  getFirebaseClientConfigurationStatus,
} from '@/lib/firebase-client-config';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

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

export const auth = {
  get currentUser() {
    try {
      return getAuthInstance().currentUser;
    } catch {
      return null;
    }
  },
};

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
  // Formerly: read Firestore `users/{uid}`, and on first sign-in assign a role
  // from a CLIENT-SIDE email allowlist and write it. The server no longer trusts
  // Firestore for roles, so that write granted nothing -- but code that appears
  // to hand out `owner` is a loaded gun for whoever reads it next, so it is gone.
  //
  // The role is now whatever the server says it is. AuthContext sets the auth
  // cookie from the fresh ID token before its own load, and signIn* callers are
  // followed by onAuthChange doing the same, so /api/me is reachable here.
  const profile = await getCurrentUser();
  if (profile) return profile;

  // Signed in, but the server has no elevated role for this uid yet. Report the
  // least privilege rather than inventing one -- never the email allowlist.
  return appUserFromData(user, { role: 'guest' });
}

export async function signInWithGoogle(): Promise<AppUser | null> {
  const result = await signInWithPopup(getAuthInstance(), getGoogleProvider());
  return createOrUpdateUser(result.user);
}

export async function signInWithApple(): Promise<AppUser | null> {
  const result = await signInWithPopup(getAuthInstance(), getAppleProvider());
  return createOrUpdateUser(result.user);
}

/**
 * Raised when echo-auth itself is unreachable or erroring.
 *
 * Kept distinct from a rejected credential so the caller cannot turn an outage
 * into "wrong password" -- that would send a user to reset a credential that was
 * never wrong, and hide the real fault.
 */
export class SignInUnavailableError extends Error {
  constructor() {
    super('Sign-in is temporarily unavailable');
    this.name = 'SignInUnavailableError';
  }
}

/**
 * Sign in with email and password.
 *
 * echo-auth is the fleet's ONE identity runtime (CLAUDE.md LAW 2026-07-31), so
 * it is asked first, through our own origin (see app/api/auth/login).
 *
 * Firebase remains a FALLBACK, and only for the one case where it is still
 * needed: echo-auth imported its users once, so an account created since that
 * import exists in Firebase and not yet in echo_auth -- registration still mints
 * Firebase accounts. Cutting the fallback before registration moves would lock
 * those people out. echo-auth handles legacy PASSWORDS itself (it verifies
 * against Firebase once, then re-hashes to argon2id), so this fallback is about
 * unknown ACCOUNTS, not unmigrated passwords.
 *
 * The fallback runs only on a definite INVALID_CREDENTIALS answer. A 503 is
 * rethrown, because retrying an outage against Firebase would quietly restore
 * the dependency this is removing, and would mask that echo-auth is down.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AppUser | null> {
  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new SignInUnavailableError();
  }

  if (response.ok) {
    const session = await response.json().catch(() => null);
    if (typeof session?.access_token === 'string' && session.access_token) {
      // Publish the session before resolving the profile: /api/me authenticates
      // with this cookie, and AuthContext's Firebase listener will not fire for
      // an echo-auth sign-in, so nothing else is going to set it.
      setAuthCookie(session.access_token);
      return getCurrentUser();
    }
    throw new SignInUnavailableError();
  }

  if (response.status === 503) throw new SignInUnavailableError();

  if (response.status !== 401) {
    // 400s are our own contract (missing fields); nothing for Firebase to add.
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Sign-in failed');
  }

  const result = await signInWithEmailAndPassword(getAuthInstance(), email, password);
  return createOrUpdateUser(result.user);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuthInstance());
}

/**
 * Ask the server who the current user is.
 *
 * This used to read Firestore `users/{uid}` straight from the browser, which put
 * a Google project on the critical path of every authenticated page: when the
 * billing accounts closed and Firestore began returning 429, the client could no
 * longer resolve its own role. It also had the role read by the same party it
 * authorises.
 *
 * GET /api/me resolves it server-side instead (echo-auth verifies the token, the
 * role comes from the claim or Postgres). The auth cookie is already set by
 * AuthContext before this runs, so a same-origin fetch carries the credential.
 *
 * A 503 is deliberately NOT treated as "signed out". The server uses it to say
 * "an auth backend is down", and silently returning null here would log the user
 * out during an outage and hide the cause -- the exact confusion that made the
 * Firestore incident look like a login bug for 16 hours.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const currentUser = getAuthInstance().currentUser;
  if (!currentUser) return null;

  const response = await fetch('/api/me', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`identity unavailable (${response.status})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return appUserFromData(currentUser, data);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  try {
    return onAuthStateChanged(getAuthInstance(), callback);
  } catch {
    queueMicrotask(() => callback(null));
    return () => undefined;
  }
}

// isOwner() removed: Firestore-only and had zero callers. Ask /api/me.

// promoteToOwner() removed: Firestore-only, zero callers, and role
// changes belong on the server behind an admin gate, not in the browser.


/** Legacy worker-role values retained for migration and reconciliation tooling. */
export type StoredWorkerRole = LegacyWorkerRole;
