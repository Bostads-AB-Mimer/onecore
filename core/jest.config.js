/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  setupFiles: ['<rootDir>/.jest/common.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/common/test/matchers.ts'],
}
