/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  setupFiles: ['<rootDir>/.jest/common.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/common/test/matchers.ts'],
}
