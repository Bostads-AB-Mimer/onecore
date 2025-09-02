/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  silent: false, // don’t hide console.*
  verbose: true, // show test names (helps scanning)

  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/src/tests/setup.ts'],
}
