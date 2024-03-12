/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  transformIgnorePatterns: ['node_modules/(?!(onecore-types)/)'],
  extensionsToTreatAsEsm: ['.d.ts, .ts'],
}
