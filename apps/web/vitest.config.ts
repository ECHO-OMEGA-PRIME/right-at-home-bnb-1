import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// apps/web has no test runner of its own. Rather than add a dependency, this
// reuses the vitest already present in the monorepo and maps the `@/` alias
// that the Next.js tsconfig defines, so lib tests can import app modules.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    passWithNoTests: true,
  },
});
