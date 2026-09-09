import { Knex } from 'knex'
import { ContactCode } from '@src/domain'
import { RelatedContact, RelatedContactRole } from '@src/domain/contact'
import { contactNamesByCodes } from '@src/adapters/xpand/contact-lookup-query'
import { activeRelationsForMany } from './repository'
import { RoleType } from './db-model'

// Perspective of the *subject* (huvudman / lease holder).
const SUBJECT_ROLE: Record<RoleType, RelatedContactRole> = {
  god_man: 'trustee',
  forvaltare: 'administrator',
  annan_fakturamottagare: 'otherInvoiceRecipient',
}

// Perspective of the *related* contact (the guardian / the recipient).
const RELATED_ROLE: Record<RoleType, RelatedContactRole> = {
  god_man: 'trusteeFor',
  forvaltare: 'administratorFor',
  annan_fakturamottagare: 'otherInvoiceRecipientFor',
}

/**
 * All related contacts for each requested code, keyed by trimmed code.
 * Edges come from `contact_relation`; names and protected-identity
 * redaction come from Xpand `cmctc`. Edges whose other side no longer
 * exists in Xpand are dropped. Contacts with no relations are absent from
 * the map (callers default to []).
 */
const relatedContactsForMany = async (
  xpandDb: Knex,
  contactsDb: Knex,
  contactCodes: ContactCode[]
): Promise<Map<string, RelatedContact[]>> => {
  const result = new Map<string, RelatedContact[]>()
  const requested = new Set(
    contactCodes.map((c) => c.trim()).filter((c) => c.length > 0)
  )
  if (requested.size === 0) return result

  const rows = await activeRelationsForMany(contactsDb, [...requested])
  if (rows.length === 0) return result

  const otherCodes = new Set<string>()
  for (const r of rows) {
    otherCodes.add(r.subject_contact_code)
    otherCodes.add(r.related_contact_code)
  }
  const names = await contactNamesByCodes(xpandDb, [...otherCodes])

  const push = (owner: string, other: string, role: RelatedContactRole) => {
    const name = names.get(other)
    if (!name) return
    const list = result.get(owner) ?? []
    if (list.some((r) => r.contactCode === other && r.role === role)) return
    list.push({ contactCode: other, role, ...name })
    result.set(owner, list)
  }

  for (const r of rows) {
    if (requested.has(r.subject_contact_code)) {
      push(
        r.subject_contact_code,
        r.related_contact_code,
        SUBJECT_ROLE[r.role_type]
      )
    }
    if (requested.has(r.related_contact_code)) {
      push(
        r.related_contact_code,
        r.subject_contact_code,
        RELATED_ROLE[r.role_type]
      )
    }
  }

  return result
}

const relatedContactsFor = async (
  xpandDb: Knex,
  contactsDb: Knex,
  contactCode: ContactCode
): Promise<RelatedContact[]> =>
  (await relatedContactsForMany(xpandDb, contactsDb, [contactCode])).get(
    contactCode.trim()
  ) ?? []

export { relatedContactsFor, relatedContactsForMany }
