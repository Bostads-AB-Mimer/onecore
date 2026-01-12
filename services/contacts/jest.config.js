import { pathsToModuleNameMapper } from 'ts-jest'
import tsConfig from './tsconfig.json' with { type: 'json' }

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(tsConfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  globalSetup: '<rootDir>/.jest/start-test-instance.ts',
  globalTeardown: '<rootDir>/.jest/stop-test-instance.ts',
}
