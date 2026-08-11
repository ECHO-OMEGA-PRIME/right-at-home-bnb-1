#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// RAH uses ECHO's single controlled Firebase project. The retired
// rightathome-prod identifier caused the original P0 login outage and must
// never return to runtime, deployment, test, or maintenance paths.
const expectedProject = 'echo-prime-ai';
const forbiddenProject = 'rightathome-prod';

const failures = [];
const passes = [];

function relative(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function read(relativePath) {
  const file = path.join(root, ...relativePath.split('/'));
  if (!fs.existsSync(file)) {
    failures.push(`Missing required file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function assert(name, condition, detail = '') {
  if (condition) passes.push(name);
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
}

function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.next' ||
      entry.name === '.git' ||
      entry.name === '.venv' ||
      entry.name === '__pycache__' ||
      entry.name === '.pytest_cache' ||
      entry.name === '.turbo' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === 'coverage' ||
      entry.name === '.cache' ||
      entry.name.startsWith('.edge-')
    ) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, output);
    else output.push(fullPath);
  }
  return output;
}

const sourceExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.ps1',
]);

const sourceRoots = ['apps', 'packages', 'backend', 'bridge'].map((item) =>
  path.join(root, item),
);
const sourceFiles = sourceRoots
  .flatMap((directory) => walk(directory))
  .filter((file) => sourceExtensions.has(path.extname(file).toLowerCase()));

const selectedRootAndToolFiles = [
  path.join(root, 'deploy.ps1'),
  ...walk(path.join(root, 'tools')).filter(
    (file) =>
      sourceExtensions.has(path.extname(file).toLowerCase()) &&
      !path.basename(file).startsWith('p0_'),
  ),
];

const runtimeFiles = [...new Set([...sourceFiles, ...selectedRootAndToolFiles])];
const forbiddenHits = [];
for (const file of runtimeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(forbiddenProject)) forbiddenHits.push(relative(file));
}
assert(
  'No runtime, deployment, test, or maintenance source references the forbidden Firebase project',
  forbiddenHits.length === 0,
  forbiddenHits.join(', '),
);

const obsoleteApiHost = 'api.rightathome.bnb';
const obsoleteApiHits = [];
for (const file of runtimeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(obsoleteApiHost)) obsoleteApiHits.push(relative(file));
}
assert(
  'No runtime, deployment, test, or maintenance source references the obsolete API host',
  obsoleteApiHits.length === 0,
  obsoleteApiHits.join(', '),
);

const firebaseClient = read('apps/web/src/lib/firebase-client-config.ts');
assert(
  `Canonical web Firebase client config names ${expectedProject}`,
  firebaseClient.includes(`RAH_FIREBASE_PROJECT_ID = '${expectedProject}'`),
);
assert(
  'Web Firebase client configuration fails on project mismatch',
  firebaseClient.includes('Firebase project mismatch'),
);

const auth = read('apps/web/src/lib/auth.ts');
assert(
  'Web auth checks existing Firebase app project identity',
  auth.includes('existing.options.projectId !== config.projectId'),
);
assert(
  'Web auth does not treat /properties/new as a public property detail',
  auth.includes("route !== '/properties/new'"),
);
assert(
  'Legacy worker specializations normalize to worker',
  auth.includes("value === 'cleaner'") && auth.includes("return 'worker'"),
);

const middleware = read('apps/web/middleware.ts');
assert(
  'Middleware protects /properties/new',
  middleware.includes("'/properties/new'") && middleware.includes('ADMIN_ONLY_PREFIXES'),
);
assert(
  'Middleware rejects production development tokens and verifies sessions authoritatively',
  middleware.includes('isDevToken(authToken) && !devLoginEnabled()') &&
    middleware.includes('rejectDevApiToken') &&
    middleware.includes('await authoritativeSession(request)') &&
    middleware.includes("new URL('/api/me', request.url)"),
);

const routeGuard = read('apps/web/src/components/properties/PropertiesRouteGuard.tsx');
assert(
  'Property route guard requires owner/admin on create route',
  routeGuard.includes('canManageProperties') && routeGuard.includes("'/properties/new'"),
);
assert(
  'Guest property page hides Add Property control',
  routeGuard.includes("a[href='/properties/new']") && routeGuard.includes('display: none'),
);

const providers = read('apps/web/app/providers.tsx');
assert(
  'Unused Firestore SyncProvider is not mounted',
  providers.includes('SyncProvider is deliberately NOT mounted') &&
    !providers.includes('<SyncProvider'),
);
assert(
  'Shared guest_user sync identity removed',
  !providers.includes("'guest_user'"),
);

const admin = read('apps/web/src/lib/firebase-admin.ts');
assert(
  `Firebase Admin validates ${expectedProject} service account`,
  admin.includes(`EXPECTED_PROJECT_ID = '${expectedProject}'`) &&
    admin.includes('serviceAccount.project_id !== EXPECTED_PROJECT_ID'),
);

const vrboWebhook = read('apps/web/app/api/webhooks/vrbo/route.ts');
assert(
  'VRBO webhook persists to Postgres without Firebase',
  vrboWebhook.includes("import prisma from '@/lib/prisma'") &&
    !vrboWebhook.includes("from 'firebase-admin/app'") &&
    vrboWebhook.includes('verifySignature'),
);

const health = read('apps/web/app/api/health/route.ts');
assert(
  'Health endpoint reports expected and configured Firebase project IDs safely',
  health.includes('expectedProjectId') && health.includes('configuredProjectId'),
);

const dynamicRoutePaths = [
  'apps/web/app/api/bookings/calendar/route.ts',
  'apps/web/app/api/integrations/paypal/callback/route.ts',
  'apps/web/app/api/integrations/paypal/transactions/route.ts',
  'apps/web/app/api/integrations/paypal/balance/route.ts',
  'apps/web/app/api/cron/guest-messages/route.ts',
  'apps/web/app/api/cron/vrbo-sync/route.ts',
];
const nonDynamicRoutes = dynamicRoutePaths.filter(
  (routePath) => !read(routePath).includes("export const dynamic = 'force-dynamic';"),
);
assert(
  'Request-dependent calendar, PayPal, and cron routes are explicitly dynamic',
  nonDynamicRoutes.length === 0,
  nonDynamicRoutes.join(', '),
);

const mobileFirebase = read('apps/mobile/src/services/firebase-config.ts');
assert(
  `Mobile Firebase configuration is locked to ${expectedProject}`,
  mobileFirebase.includes(`RAH_FIREBASE_PROJECT_ID = '${expectedProject}'`) &&
    mobileFirebase.includes('Mobile Firebase project mismatch'),
);

const mobileAuth = read('apps/mobile/src/services/auth.ts');
assert(
  'Mobile auth validates existing Firebase app identity',
  mobileAuth.includes('existing.options.projectId !== firebaseConfig.projectId'),
);
assert(
  'Mobile push registration uses the configured API base',
  mobileAuth.includes('EXPO_PUBLIC_API_URL') &&
    !mobileAuth.includes('api.rightathome.bnb'),
);

const backendPhotos = read('backend/routers/photos.py');
assert(
  `Backend photo storage requires ${expectedProject}`,
  backendPhotos.includes(`EXPECTED_FIREBASE_PROJECT_ID = "${expectedProject}"`) &&
    backendPhotos.includes('FIREBASE_STORAGE_BUCKET is required'),
);

const appEnv = read('apps/web/.env.example');
const mobileEnv = read('apps/mobile/.env.example');
const backendEnv = read('backend/.env.example');
const railwayEnv = read('backend/.env.railway');
const rootEnv = read('.env.example');
assert(
  `Web environment template uses ${expectedProject}`,
  appEnv.includes(`NEXT_PUBLIC_FIREBASE_PROJECT_ID=${expectedProject}`),
);
assert(
  `Mobile environment template uses ${expectedProject} and current API domain`,
  mobileEnv.includes(`EXPO_PUBLIC_FIREBASE_PROJECT_ID=${expectedProject}`) &&
    mobileEnv.includes('EXPO_PUBLIC_API_URL=https://api.rah-midland.com'),
);
assert(
  `Backend environment template uses ${expectedProject}`,
  backendEnv.includes(`FIREBASE_PROJECT_ID=${expectedProject}`),
);
assert(
  'Legacy Railway environment is inert',
  railwayEnv.includes('RAILWAY_DEPLOYMENT_DISABLED=true') &&
    railwayEnv.includes(`FIREBASE_PROJECT_ID=${expectedProject}`),
);
assert(
  `Root environment template uses ${expectedProject}`,
  rootEnv.includes(`FIREBASE_PROJECT_ID="${expectedProject}"`) &&
    rootEnv.includes(`NEXT_PUBLIC_FIREBASE_PROJECT_ID="${expectedProject}"`),
);
assert(
  'Environment templates do not contain forbidden Firebase project',
  !appEnv.includes(forbiddenProject) &&
    !mobileEnv.includes(forbiddenProject) &&
    !backendEnv.includes(forbiddenProject) &&
    !railwayEnv.includes(forbiddenProject) &&
    !rootEnv.includes(forbiddenProject),
);

const syncTool = read('apps/web/tools/sync-vercel-env.py');
assert(
  'Vercel sync tool requires explicit confirmation',
  syncTool.includes('SYNC_RAH_VERCEL_ENV') && syncTool.includes('--confirm'),
);
assert(
  `Vercel sync tool is locked to ${expectedProject}`,
  syncTool.includes(`EXPECTED_PROJECT_ID = "${expectedProject}"`),
);
assert(
  'Vercel sync tool no longer references obsolete O drive vault path',
  !syncTool.includes('O:/ECHO_OMEGA_PRIME') && !syncTool.includes('O:\\ECHO_OMEGA_PRIME'),
);

const deploy = read('deploy.ps1');
assert(
  'Deployment script requires explicit production confirmation',
  deploy.includes('DEPLOY_RAH_PRODUCTION') &&
    deploy.includes('Production deployment requires a clean Git working tree'),
);
assert(
  'Deployment script disables legacy backend deployment',
  deploy.includes('Legacy Cloud Run/Railway deployment is disabled'),
);

for (const name of passes) console.log(`PASS ${name}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`P0 STATIC ASSERTIONS RED (${failures.length} failure(s))`);
  process.exit(1);
}

console.log(`P0 STATIC ASSERTIONS GREEN (${passes.length} checks)`);
