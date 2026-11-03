import { logger } from '@onecore/utilities'
import { ContactLookup } from './sync-invoice-recipient'

// The value the contacts service puts in every personal field it redacts.
const REDACTED = 'redacted'

/**
 * What became of a protected identity's details:
 * - `shown`: filled in from the contacts service (a tenant or invoice
 *   recipient, already anonymised in Xpand)
 * - `withheld`: the contacts service redacts the contact as well
 * - `unavailable`: the contacts service could not be asked, so the details
 *   stay hidden (fails closed)
 */
export type ProtectedIdentityDetails = 'shown' | 'withheld' | 'unavailable'

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
 * A protected identity gets `protectedIdentityDetails` so clients can tell
 * withheld details from a failed lookup. Fails closed: if the contacts
 * service fails, or redacts the contact itself, the identity fields are
 * returned unchanged (still redacted).
 */
export const withProtectedIdentityDetails = async <T extends LegacyIdentity>(
  contacts: ContactLookup,
  legacy: T
): Promise<T & { protectedIdentityDetails?: ProtectedIdentityDetails }> => {
  if (!legacy.protectedIdentity) return legacy

  const result = await contacts
    .getByContactCode(legacy.contactCode)
    .catch((err: unknown): undefined => {
      logger.error(
        { contactCode: legacy.contactCode, err },
        'withProtectedIdentityDetails.contactLookupThrew'
      )
      return undefined
    })

  if (!result) return { ...legacy, protectedIdentityDetails: 'unavailable' }

  if (!result.ok) {
    // Leasing found the contact, so a 404 here means the two disagree — worth
    // a warning, but not a failure of this request.
    if (result.err === 'not-found') {
      logger.warn(
        { contactCode: legacy.contactCode },
        'withProtectedIdentityDetails.contactNotFound'
      )
    } else {
      logger.error(
        { contactCode: legacy.contactCode, err: result.err },
        'withProtectedIdentityDetails.contactLookupFailed'
      )
    }
    return { ...legacy, protectedIdentityDetails: 'unavailable' }
  }

  const contact = result.data
  if (contact.type !== 'individual' || contact.personal.fullName === REDACTED) {
    return { ...legacy, protectedIdentityDetails: 'withheld' }
  }

  const { personal } = contact
  return {
    ...legacy,
    protectedIdentityDetails: 'shown',
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
