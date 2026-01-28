/**
 * Vitest Configuration for RightAtHomeBnB Testing Suite
 * Comprehensive test configuration for unit, integration, and E2E tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Global test configuration
    globals: true,

    // Environment setup
    environment: 'happy-dom',

    // Test file patterns
    include: [
      'unit/**/*.test.ts',
      'integration/**/*.test.ts',
      'e2e/**/*.test.ts'
    ],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**'
    ],

    // Setup files
    setupFiles: ['./src/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        '../shared/src/**/*.ts',
        '../cloud-sync/src/**/*.ts',
        '../api/src/**/*.ts'
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts'
      ],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70
      }
    },

    // Test timeout
    testTimeout: 30000,

    // Hook timeout
    hookTimeout: 30000,

    // Pool options for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },

    // Retry failed tests
    retry: 2,

    // Reporter configuration
    reporters: ['verbose', 'html'],

    // Output directory for reports
    outputFile: {
      html: './test-results/report.html',
      json: './test-results/report.json'
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@cloud-sync': path.resolve(__dirname, '../cloud-sync/src'),
      '@fixtures': path.resolve(__dirname, './utils/fixtures'),
      '@helpers': path.resolve(__dirname, './utils/helpers'),
      '@mocks': path.resolve(__dirname, './utils/mocks')
    }
  }
});
