import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      // Prefer "browser" export so Svelte uses client build (mount) in jsdom tests
      conditions: ['browser', 'import', 'module', 'default'],
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,svelte}'],
        exclude: [
          '**/*.test.ts',
          '**/__tests__/**',
          '**/test/**',
          '**/setup.ts',
          '**/*.d.ts',
        ],
        reporter: ['text', 'html', 'lcov'],
        reportsDir: 'coverage',
        // Optional: fail if coverage drops below (raise as needed)
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  })
)
