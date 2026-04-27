import { Factory } from 'fishery'
import type {
  SyncContactToLeasingPayload,
  SyncContactToEconomyPayload,
  SyncContactToWorkOrderPayload,
} from '@onecore/types'

export const SyncContactToLeasingPayloadFactory =
  Factory.define<SyncContactToLeasingPayload>(({ sequence }) => ({
    contactCode: `P${100000 + sequence}`,
    firstName: 'Knut',
    lastName: 'Kansen',
    fullName: 'Kansen, Knut',
    nationalRegistrationNumber: '199001011234',
    emailAddress: 'knut@example.com',
    phoneNumber: '0701234567',
    street: 'Storgatan 1',
    zipCode: '72100',
    city: 'Västerås',
  }))

export const SyncContactToEconomyPayloadFactory =
  Factory.define<SyncContactToEconomyPayload>(({ sequence }) => ({
    contactCode: `P${100000 + sequence}`,
    fullName: 'Kansen, Knut',
    street: 'Storgatan 1',
    zipCode: '72100',
    city: 'Västerås',
    emailAddress: 'knut@example.com',
  }))

export const SyncContactToWorkOrderPayloadFactory =
  Factory.define<SyncContactToWorkOrderPayload>(({ sequence }) => ({
    contactCode: `P${100000 + sequence}`,
    fullName: 'Kansen, Knut',
    emailAddress: 'knut@example.com',
    phoneNumber: '0701234567',
  }))
