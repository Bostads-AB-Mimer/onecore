export * from './services/contacts-service/schema'
export * from './services/contacts-service/api-types'
export * from './domain'
// Runtime, unlike the rest of ./domain: core checks the age rule before registration starts.
export { isOldEnough, MINIMUM_AGE, type AgeRule } from './domain/age-rule'
