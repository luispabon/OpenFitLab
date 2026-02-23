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
    },
  })
)
