import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/helpers.ts'],
    setupFiles: ['./__tests__/setup.ts'],
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', 'github-actions']
      : ['default'],
    clearMocks: true,
  },
})
