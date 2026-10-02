export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/.jest/common.ts'],
  roots: ['<rootDir>/test'],
}
