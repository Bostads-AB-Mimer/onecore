// Shared test fixtures for the loan / return / receipt service modules.
import type {
  KeyDetails,
  Card,
  Lease,
  Tenant,
  Contact,
  KeyLoanWithDetails,
} from '@/services/types'

export function makeKey(
  overrides: Partial<KeyDetails> & { id: string }
): KeyDetails {
  return {
    keyName: 'test-key',
    keyType: 'LGH',
    disposed: false,
    ...overrides,
  } as KeyDetails
}

export function makeCard(overrides: Partial<Card> & { cardId: string }): Card {
  return { ...overrides } as Card
}

export function makeTenant(
  overrides: Partial<Tenant> & { contactCode: string }
): Tenant {
  return {
    contactKey: 'key-' + overrides.contactCode,
    firstName: 'First',
    lastName: 'Last',
    fullName: 'First Last',
    nationalRegistrationNumber: '199001011234',
    birthDate: '1990-01-01',
    isTenant: true,
    ...overrides,
  } as Tenant
}

export function makeContact(
  overrides: Partial<Contact> & { contactCode: string }
): Contact {
  return {
    contactKey: 'key-' + overrides.contactCode,
    firstName: 'First',
    lastName: 'Last',
    fullName: 'First Last',
    nationalRegistrationNumber: '199001011234',
    birthDate: '1990-01-01',
    phoneNumbers: [],
    isTenant: true,
    ...overrides,
  } as Contact
}

export function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    leaseId: 'lease-1',
    leaseNumber: '01',
    leaseStartDate: '2025-01-01',
    status: 'Current',
    rentalPropertyId: 'prop-1',
    type: 'Bostadskontrakt',
    tenants: [],
    ...overrides,
  } as Lease
}

export function makeLoan(
  overrides: Partial<KeyLoanWithDetails> & { id: string }
): KeyLoanWithDetails {
  return {
    loanType: 'TENANT',
    contact: 'P001',
    contact2: null,
    returnedAt: null,
    keysArray: [],
    keyCardsArray: [],
    ...overrides,
  } as KeyLoanWithDetails
}
