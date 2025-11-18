// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only needed if you want stricter module isolation between files
    // environmentOptions: { isolate: true },

    coverage: {
      provider: 'v8',               // default in Vitest 1.x
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov'],


      include: [
        // your real TS/JS source files
        'src/**/*.ts',
        'src/**/*.tsx',
        // (adjust if you keep sources elsewhere)
      ],

      exclude: [
        // test files & helpers
        'test/**',
        '**/*.test.*',
        '**/__tests__/**',
        '**/*.spec.*',

        // build outputs & tooling
        'dist/**',
        'coverage/**',
        'scripts/**',

        // --- Assembly / WASM stuff to ignore from coverage ---
        // Any AssemblyScript source (your case: rankings-core/wasm/assembly/index.ts)
        '**/wasm/assembly/**',
        'wasm/assembly/**',
        'src/**/wasm/assembly/**',        
        'wasm/dist/**',
        'src/wasm/wasm-bridge.ts',
        // and any other internal build artifacts:
        '**/*.d.ts',
        '**/dist/**',

        // Compiled wasm binaries and any bridge stubs you don’t want covered
        '**/*.wasm',
        '**/ratings.wasm',
        'src/**/wasm/ratings.wasm',

        // If you vendor or generate code here, exclude as needed:
        // 'vendor/**',
      ],
    },
  },
});
