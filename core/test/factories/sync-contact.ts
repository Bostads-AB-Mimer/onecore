import { Factory } from 'fishery'
import type {
  SyncContactToEconomyPayload,
  SyncContactToWorkOrderPayload,
} from '@onecore/types'

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
