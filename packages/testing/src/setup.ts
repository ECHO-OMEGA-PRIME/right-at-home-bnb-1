/**
 * Vitest Global Setup
 * Configures test environment and global utilities
 */

import { beforeAll, afterAll, afterEach } from 'vitest';

// Setup global test environment
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';

  console.log('[Test Setup] Test environment initialized');
});

afterAll(async () => {
  console.log('[Test Cleanup] Test environment cleaned up');
});

afterEach(() => {
  // Clear any mocks after each test
});

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        generateId: () => string;
        waitFor: (ms: number) => Promise<void>;
      };
    }
  }
}

// @ts-ignore
globalThis.testUtils = {
  generateId: () => `test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};
