import type { Contact } from '@onecore/contacts/domain'
import type { SyncContactToLeasingPayload } from '@onecore/types'
import { toSyncPayload } from '../sync-contacts/payload'

export const toSyncLeasingPayload = (
  contact: Contact
): SyncContactToLeasingPayload => {
  const { nationalId, ...rest } = toSyncPayload(contact)
  return { ...rest, nationalRegistrationNumber: nationalId }
}
