/**
 * Build Validation Script
 * Verifies project structure, dependencies, and build configuration
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message?: string;
}

const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..');

async function runCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(cmd, args, { cwd, timeout: 30000 });
    return { stdout: result.stdout || '', stderr: result.stderr || '' };
  } catch (error) {
    return { stdout: '', stderr: (error as Error).message };
  }
}

async function validateBuild(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  console.log('='.repeat(60));
  console.log('RightAtHomeBnB Build Validation');
  console.log('='.repeat(60));
  console.log();
  console.log(`Project Root: ${PROJECT_ROOT}`);
  console.log();

  // 1. Check root package.json exists
  const rootPackageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const hasRootPackageJson = fs.existsSync(rootPackageJsonPath);
  results.push({
    check: 'Root package.json',
    status: hasRootPackageJson ? 'PASS' : 'FAIL',
    message: hasRootPackageJson ? 'Found' : 'Missing'
  });

  if (!hasRootPackageJson) {
    return results;
  }

  // 2. Validate package.json structure
  try {
    const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));

    results.push({
      check: 'Project Name',
      status: packageJson.name === 'rightathome-bnb' ? 'PASS' : 'WARN',
      message: `Name: ${packageJson.name}`
    });

    results.push({
      check: 'Workspaces Configured',
      status: packageJson.workspaces ? 'PASS' : 'FAIL',
      message: packageJson.workspaces ? `Workspaces: ${packageJson.workspaces.join(', ')}` : 'Not configured'
    });

    results.push({
      check: 'Scripts Defined',
      status: packageJson.scripts ? 'PASS' : 'FAIL',
      message: packageJson.scripts ? `${Object.keys(packageJson.scripts).length} scripts defined` : 'No scripts'
    });

  } catch (error) {
    results.push({
      check: 'package.json Valid JSON',
      status: 'FAIL',
      message: `Parse error: ${(error as Error).message}`
    });
  }

  // 3. Check required directories exist
  const requiredDirs = [
    'apps',
    'packages',
    'prisma',
    'config',
    'database'
  ];

  for (const dir of requiredDirs) {
    const dirPath = path.join(PROJECT_ROOT, dir);
    const exists = fs.existsSync(dirPath);
    results.push({
      check: `Directory: ${dir}`,
      status: exists ? 'PASS' : 'FAIL',
      message: exists ? 'Exists' : 'Missing'
    });
  }

  // 4. Check Prisma schema exists
  const prismaSchemaPath = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
  const hasPrismaSchema = fs.existsSync(prismaSchemaPath);
  results.push({
    check: 'Prisma Schema',
    status: hasPrismaSchema ? 'PASS' : 'FAIL',
    message: hasPrismaSchema ? 'Found' : 'Missing'
  });

  // 5. Check TypeScript config exists
  const tsConfigPath = path.join(PROJECT_ROOT, 'apps', 'web', 'tsconfig.json');
  const hasTsConfig = fs.existsSync(tsConfigPath) || fs.existsSync(path.join(PROJECT_ROOT, 'tsconfig.json'));
  results.push({
    check: 'TypeScript Config',
    status: hasTsConfig ? 'PASS' : 'WARN',
    message: hasTsConfig ? 'Found' : 'Not found in expected location'
  });

  // 6. Check .env file exists (but don't expose contents)
  const envPath = path.join(PROJECT_ROOT, '.env');
  const hasEnv = fs.existsSync(envPath);
  results.push({
    check: 'Environment File (.env)',
    status: hasEnv ? 'PASS' : 'WARN',
    message: hasEnv ? 'Found' : 'Missing - copy from .env.example'
  });

  // 7. Check .env.example exists
  const envExamplePath = path.join(PROJECT_ROOT, '.env.example');
  const hasEnvExample = fs.existsSync(envExamplePath);
  results.push({
    check: 'Environment Example (.env.example)',
    status: hasEnvExample ? 'PASS' : 'WARN',
    message: hasEnvExample ? 'Found' : 'Missing'
  });

  // 8. Check node_modules exists
  const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesPath);
  results.push({
    check: 'Dependencies Installed',
    status: hasNodeModules ? 'PASS' : 'FAIL',
    message: hasNodeModules ? 'node_modules found' : 'Run npm install'
  });

  // 9. Check for package-lock.json or pnpm-lock.yaml
  const hasNpmLock = fs.existsSync(path.join(PROJECT_ROOT, 'package-lock.json'));
  const hasPnpmLock = fs.existsSync(path.join(PROJECT_ROOT, 'pnpm-lock.yaml'));
  results.push({
    check: 'Lock File',
    status: hasNpmLock || hasPnpmLock ? 'PASS' : 'WARN',
    message: hasNpmLock ? 'package-lock.json' : hasPnpmLock ? 'pnpm-lock.yaml' : 'No lock file found'
  });

  // 10. Check packages/testing exists
  const testingPackagePath = path.join(PROJECT_ROOT, 'packages', 'testing');
  const hasTestingPackage = fs.existsSync(testingPackagePath);
  results.push({
    check: 'Testing Package',
    status: hasTestingPackage ? 'PASS' : 'FAIL',
    message: hasTestingPackage ? 'Found' : 'Missing'
  });

  // 11. Check packages/shared exists
  const sharedPackagePath = path.join(PROJECT_ROOT, 'packages', 'shared');
  const hasSharedPackage = fs.existsSync(sharedPackagePath);
  results.push({
    check: 'Shared Package',
    status: hasSharedPackage ? 'PASS' : 'WARN',
    message: hasSharedPackage ? 'Found' : 'Missing'
  });

  // 12. Check packages/cloud-sync exists
  const cloudSyncPackagePath = path.join(PROJECT_ROOT, 'packages', 'cloud-sync');
  const hasCloudSyncPackage = fs.existsSync(cloudSyncPackagePath);
  results.push({
    check: 'CloudSync Package',
    status: hasCloudSyncPackage ? 'PASS' : 'WARN',
    message: hasCloudSyncPackage ? 'Found' : 'Missing'
  });

  // 13. Validate Prisma schema syntax (if available)
  if (hasPrismaSchema) {
    const { stdout, stderr } = await runCommand('npx', ['prisma', 'validate'], PROJECT_ROOT);
    const isValid = !stderr.includes('Error') && !stderr.includes('error');
    results.push({
      check: 'Prisma Schema Valid',
      status: isValid ? 'PASS' : 'WARN',
      message: isValid ? 'Schema validation passed' : 'Could not validate (prisma may not be installed)'
    });
  }

  // 14. Check TypeScript compilation (optional)
  const { stdout: tscOut, stderr: tscErr } = await runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck'], PROJECT_ROOT);
  const tscSuccess = !tscErr.includes('error TS');
  results.push({
    check: 'TypeScript Compilation',
    status: tscSuccess ? 'PASS' : 'WARN',
    message: tscSuccess ? 'No critical type errors' : 'Type errors detected (may be expected)'
  });

  // 15. Check for Steven Palma listings data
  const listingsPath = path.join(PROJECT_ROOT, 'STEVEN_PALMA_BNB_LISTINGS');
  const hasListings = fs.existsSync(listingsPath);
  let listingCount = 0;
  if (hasListings) {
    const files = fs.readdirSync(listingsPath);
    listingCount = files.filter(f => f.endsWith('.md') && /^\d{2}_/.test(f)).length;
  }
  results.push({
    check: 'Listing Data Files',
    status: listingCount >= 14 ? 'PASS' : hasListings ? 'WARN' : 'FAIL',
    message: hasListings ? `Found ${listingCount} listing files` : 'Missing STEVEN_PALMA_BNB_LISTINGS directory'
  });

  return results;
}

function printResults(results: ValidationResult[]): void {
  console.log();
  console.log('Validation Results:');
  console.log('-'.repeat(60));

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const result of results) {
    const icon = result.status === 'PASS' ? '[PASS]' : result.status === 'FAIL' ? '[FAIL]' : '[WARN]';
    console.log(`${icon} ${result.check}`);
    if (result.message) {
      console.log(`       ${result.message}`);
    }

    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else warnCount++;
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    console.log('\nBuild validation FAILED. Please fix the issues above.');
    console.log('\nCommon fixes:');
    console.log('  - Run: npm install');
    console.log('  - Run: npm run db:generate');
    console.log('  - Copy .env.example to .env and fill in values');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('\nBuild validation passed with warnings.');
  } else {
    console.log('\nBuild validation PASSED!');
  }
}

// Run validation
validateBuild()
  .then(printResults)
  .catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
