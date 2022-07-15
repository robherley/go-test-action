import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['helpers.ts'],
  reporters: ['default', 'github-actions'],
}

export default config
