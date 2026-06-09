import { Factory } from 'fishery'
import type { SyncContactToLeasingPayload } from '@onecore/types'

export const SyncContactToLeasingPayloadFactory =
  Factory.define<SyncContactToLeasingPayload>(({ sequence }) => ({
    contactCode: `P${100000 + sequence}`,
  }))
