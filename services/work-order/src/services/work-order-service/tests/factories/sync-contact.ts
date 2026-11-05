import { Factory } from 'fishery'
import type { SyncContactToWorkOrderPayload } from '@onecore/types'

export const SyncContactToWorkOrderPayloadFactory =
  Factory.define<SyncContactToWorkOrderPayload>(({ sequence }) => ({
    contactCode: `P${100000 + sequence}`,
    fullName: 'Kansen, Knut',
    emailAddress: 'knut@example.com',
    phoneNumber: '0701234567',
  }))
