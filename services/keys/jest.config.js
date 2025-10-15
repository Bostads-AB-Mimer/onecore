/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  transformIgnorePatterns: ['node_modules/(?!(onecore-types)/)'],
  extensionsToTreatAsEsm: ['.d.ts', '.ts'],
  setupFiles: ['<rootDir>/.jest/common.ts'],
  maxWorkers: 1, // Run tests serially for database isolation
  globalSetup: '<rootDir>/.jest/migrate.ts',
  globalTeardown: '<rootDir>/.jest/teardown.ts',
}
