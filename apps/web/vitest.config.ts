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
    // Run test files in forked processes, one at a time.
    //
    // With the default worker-thread pool this suite segfaulted (exit 139)
    // once six files ran together, while every file passed alone and any
    // four passed together. Prisma's native query engine is loaded by more
    // than one test file, and it does not survive being initialised across
    // several worker threads in one process on Windows.
    //
    // The failure mode is what makes this worth the few seconds it costs:
    // vitest printed every test as passing and THEN crashed, so CI would
    // have gone red with no failing test to point at -- or, worse, a
    // `| tail` in a script would have shown green ticks and hidden it.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
