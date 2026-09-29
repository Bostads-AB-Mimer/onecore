/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  extensionsToTreatAsEsm: ['.d.ts, .ts'],
  setupFiles: ['<rootDir>/.jest/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/.jest/teardown-in-worker.ts'],
  maxWorkers: 1, // Run tests serially for database isolation
  globalSetup: '<rootDir>/.jest/migrate.ts',
  globalTeardown: '<rootDir>/.jest/teardown.ts',
}
