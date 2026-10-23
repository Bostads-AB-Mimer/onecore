import { logger } from '@onecore/utilities'
import type { Contact } from '@onecore/contacts/domain'
import { AdapterResult } from '../../adapters/types'
import { ContactLookup } from './sync-invoice-recipient'

// The value the contacts service puts in every personal field it redacts.
const REDACTED = 'redacted'

/** The identity fields of the legacy leasing Contact/Tenant model. */
type LegacyIdentity = {
  contactCode: string
  protectedIdentity: boolean
  firstName: string
  lastName: string
  fullName: string
  nationalRegistrationNumber: string
  birthDate: Date
}

/**
 * Fills in the identity fields leasing hides for every protected identity,
 * taking them from the contacts service — the only source allowed to decide
 * what of a protected identity may be shown. It lifts redaction for tenants
 * and invoice recipients, whose data in Xpand is already anonymised.
 *
 * Fails closed: if the contacts service fails, or redacts the contact
 * itself, the legacy record is returned unchanged (still redacted).
 */
export const withProtectedIdentityDetails = async <T extends LegacyIdentity>(
  contacts: ContactLookup,
  legacy: T
): Promise<T> => {
  if (!legacy.protectedIdentity) return legacy

  const result = await contacts
    .getByContactCode(legacy.contactCode)
    .catch((err: unknown): AdapterResult<Contact, 'unknown'> => {
      logger.error(
        { contactCode: legacy.contactCode, err },
        'withProtectedIdentityDetails.contactLookupThrew'
      )
      return { ok: false, err: 'unknown' }
    })

  if (!result.ok) {
    logger.error(
      { contactCode: legacy.contactCode, err: result.err },
      'withProtectedIdentityDetails.contactLookupFailed'
    )
    return legacy
  }

  const contact = result.data
  if (contact.type !== 'individual') return legacy

  const { personal } = contact
  if (personal.fullName === REDACTED) return legacy

  return {
    ...legacy,
    firstName: personal.firstName ?? legacy.firstName,
    lastName: personal.lastName ?? legacy.lastName,
    fullName: personal.fullName,
    nationalRegistrationNumber:
      personal.nationalId ?? legacy.nationalRegistrationNumber,
    birthDate: personal.birthDate
      ? new Date(personal.birthDate)
      : legacy.birthDate,
  }
}
