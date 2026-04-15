import { pathsToModuleNameMapper } from 'ts-jest'
import tsConfig from './tsconfig.json' with { type: 'json' }

export default {
  preset: 'ts-jest',
  forceExit: true,
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(tsConfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  setupFiles: ['<rootDir>/.jest/common.ts'],
}
