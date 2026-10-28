import { Factory } from 'fishery'
import type { SyncContactToEconomyPayload } from '@onecore/types'

export const SyncContactToEconomyPayloadFactory =
  Factory.define<SyncContactToEconomyPayload>(({ sequence }) => ({
    contactCode: `P${100000 + sequence}`,
    fullName: 'Kansen, Knut',
    street: 'Storgatan 1',
    zipCode: '72100',
    city: 'Västerås',
    emailAddress: 'knut@example.com',
  }))
