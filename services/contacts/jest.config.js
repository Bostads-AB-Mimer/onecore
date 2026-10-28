import { pathsToModuleNameMapper } from 'ts-jest'
import tsConfig from './tsconfig.json' with { type: 'json' }

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(tsConfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  setupFiles: ['<rootDir>/.jest/common.ts'],
  maxWorkers: 1,
  globalSetup: '<rootDir>/.jest/migrate.ts',
}
