import { logger } from '@onecore/utilities'
import type { Contact } from '@onecore/contacts/domain'
import { syncContactToEconomy } from '../../adapters/economy-adapter'
import { toSyncPayload } from '../../scripts/sync-contacts/payload'
import { AdapterResult } from '../../adapters/types'

/**
 * Passed in rather than imported so `sync-leases`, which builds its own
 * adapter, can hand over the instance its tests already mock.
 */
export type ContactLookup = {
  getByContactCode: (
    contactCode: string
  ) => Promise<AdapterResult<Contact, 'not-found' | 'unknown'>>
}

/**
 * Upserts a contact as an economy-service customer, creating it when missing.
 *
 * An annan fakturamottagare usually holds no lease, so nothing has ever
 * created them as a customer — `create: true` is what brings them into
 * existence. Safe to run before the relation is written: an unused customer
 * invoices nobody and is reused on retry.
 *
 * `contact-not-found` is kept apart from `sync-failed` so the caller can
 * answer an unresolvable contact code as a 404 rather than an outage.
 */
export const syncInvoiceRecipientToEconomy = async (
  contacts: ContactLookup,
  contactCode: string
): Promise<AdapterResult<null, 'contact-not-found' | 'sync-failed'>> => {
  // The contacts adapter does not catch request exceptions on reads, so a
  // network failure rejects rather than returning a result — and would reach
  // the caseworker as an unstructured 500.
  const contactResult = await contacts
    .getByContactCode(contactCode)
    .catch((err): AdapterResult<Contact, 'not-found' | 'unknown'> => {
      logger.error(
        { contactCode, err },
        'syncInvoiceRecipientToEconomy.contactLookupThrew'
      )
      return { ok: false, err: 'unknown', detail: 'contact-lookup-threw' }
    })
  if (!contactResult.ok) {
    logger.error(
      { contactCode, err: contactResult.err },
      'syncInvoiceRecipientToEconomy.contactLookupFailed'
    )
    return {
      ok: false,
      // Only a genuine 404 means "no such contact"; anything else is an
      // infrastructure failure and must not be read as an invalid code.
      err:
        contactResult.err === 'not-found' ? 'contact-not-found' : 'sync-failed',
      detail: contactResult.detail ?? contactResult.err,
    }
  }

  // Shared with sync-contacts rather than re-derived: fullName-by-type,
  // primary-else-first email and addresses[0] are one business rule, and
  // since AVTAL-289 a contact carries only its fakturaadress, so the first
  // address is the one an invoice should go to.
  const { fullName, street, zipCode, city, emailAddress } = toSyncPayload(
    contactResult.data
  )

  const syncResult = await syncContactToEconomy(
    contactCode,
    { fullName, street, zipCode, city, emailAddress },
    { create: true }
  )

  if (!syncResult.ok) {
    logger.error(
      { contactCode, err: syncResult.err },
      'syncInvoiceRecipientToEconomy.economySyncFailed'
    )
    return { ok: false, err: 'sync-failed', detail: syncResult.err }
  }

  return { ok: true, data: null }
}
