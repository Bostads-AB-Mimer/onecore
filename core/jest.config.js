/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  setupFiles: ['<rootDir>/.jest/common.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/common/test/matchers.ts'],
}
