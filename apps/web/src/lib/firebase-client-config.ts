import type { FirebaseOptions } from 'firebase/app';

export const RAH_FIREBASE_PROJECT_ID = 'rightathome-prod';

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

type RequiredFirebaseEnv = (typeof REQUIRED_ENV_VARS)[number];
type PublicEnvironment = Record<RequiredFirebaseEnv, string | undefined>;

function readPublicEnvironment(): PublicEnvironment {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

function normalized(value: string | undefined): string {
  return value?.trim() ?? '';
}

export class FirebaseConfigurationError extends Error {
  readonly code = 'RAH_FIREBASE_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'FirebaseConfigurationError';
  }
}

export function getFirebaseClientConfig(): FirebaseOptions {
  const environment = readPublicEnvironment();
  const missing = REQUIRED_ENV_VARS.filter((name) => !normalized(environment[name]));

  if (missing.length > 0) {
    throw new FirebaseConfigurationError(
      `Firebase client configuration is incomplete. Missing: ${missing.join(', ')}`,
    );
  }

  const projectId = normalized(environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  if (projectId !== RAH_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigurationError(
      `Firebase project mismatch. Expected ${RAH_FIREBASE_PROJECT_ID}, received ${projectId}.`,
    );
  }

  return {
    apiKey: normalized(environment.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: normalized(environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId,
    storageBucket: normalized(environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: normalized(environment.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: normalized(environment.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

export function getFirebaseClientConfigurationStatus() {
  const environment = readPublicEnvironment();
  const missing = REQUIRED_ENV_VARS.filter((name) => !normalized(environment[name]));
  const configuredProjectId = normalized(environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || null;

  return {
    configured: missing.length === 0 && configuredProjectId === RAH_FIREBASE_PROJECT_ID,
    expectedProjectId: RAH_FIREBASE_PROJECT_ID,
    configuredProjectId,
    missing,
    projectMatches: configuredProjectId === RAH_FIREBASE_PROJECT_ID,
  } as const;
}
