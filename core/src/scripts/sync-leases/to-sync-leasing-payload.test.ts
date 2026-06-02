import * as factory from '../../../test/factories'
import { toSyncLeasingPayload } from './to-sync-leasing-payload'

describe('toSyncLeasingPayload', () => {
  it('renames nationalId to nationalRegistrationNumber and preserves other fields', () => {
    const individual = factory.domainContact.build()

    const result = toSyncLeasingPayload(individual)

    expect(result.nationalRegistrationNumber).toBe(
      individual.personal.nationalId
    )
    expect(result).not.toHaveProperty('nationalId')
    expect(result.contactCode).toBe(individual.contactCode)
    expect(result.firstName).toBe(individual.personal.firstName)
    expect(result.lastName).toBe(individual.personal.lastName)
    expect(result.fullName).toBe(individual.personal.fullName)
  })
})
