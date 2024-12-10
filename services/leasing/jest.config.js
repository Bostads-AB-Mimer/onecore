/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: [
    '<rootDir>/build/',
    //todo: excludes the db tests so that GH-action does not remove data by accident
    //todo: remove below line when test db connection exists for GH-action
  ].concat(
    process.env.NODE_ENV === 'test-ci'
      ? [
          '<rootDir>/src/services/lease-service/tests/adapters/',
          '<rootDir>/src/services/lease-service/tests/sync-internal-parking-space-listings-from-xpand.test.ts',
          '<rootDir>/src/services/lease-service/tests/offer-service.test.ts',
          '<rootDir>/src/services/lease-service/tests/update-or-create-application-profile.test.ts',
        ]
      : []
  ),
  //todo: maxWorkers: 1 runs all tests in sequence so that we don't get deadlocks for db tests
  //todo: implement a more elegant solution (run db tests in sequence, all other tests in parallel)
  maxWorkers: 1,
  transformIgnorePatterns: ['node_modules/(?!(onecore-types)/)'],
  extensionsToTreatAsEsm: ['.d.ts, .ts'],
  setupFiles: ['<rootDir>/.jest/common.ts'],
}
