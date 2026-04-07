import { pathsToModuleNameMapper } from 'ts-jest'
import tsConfig from './tsconfig.json' with { type: 'json' }

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  moduleNameMapper: pathsToModuleNameMapper(tsConfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
}
