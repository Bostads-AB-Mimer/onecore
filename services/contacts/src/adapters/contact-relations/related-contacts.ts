import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import { ContactCode } from '@src/domain'
import { RelatedContact, RelatedContactRole } from '@src/domain/contact'
import { contactNamesByCodes } from '@src/adapters/xpand/contact-lookup-query'
import { RENSAD_GDPR } from '@src/adapters/xpand/relation-sql'
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

  // Trim once here: MSSQL ignores trailing blanks in comparisons, so
  // `activeRelationsForMany` can return a stored code with trailing
  // whitespace even though the requested codes above are already trimmed.
  // Use these trimmed values everywhere below (requested-set checks,
  // counterpart lookup and `push`) so such a row isn't silently dropped.
  // The GDPR-erased placeholder is never a real party (services/CLAUDE.md);
  // the import excludes it at write time, this guards other writers.
  const trimmedRows = rows
    .map((r) => ({
      subject: r.subject_contact_code.trim(),
      related: r.related_contact_code.trim(),
      roleType: r.role_type,
    }))
    .filter((r) => r.subject !== RENSAD_GDPR && r.related !== RENSAD_GDPR)

  // Only the counterpart of each requested code needs a name lookup — not
  // the requested codes themselves.
  const counterpartCodes = new Set<string>()
  for (const r of trimmedRows) {
    if (requested.has(r.subject)) counterpartCodes.add(r.related)
    if (requested.has(r.related)) counterpartCodes.add(r.subject)
  }
  const names = await contactNamesByCodes(xpandDb, [...counterpartCodes])

  const push = (owner: string, other: string, role: RelatedContactRole) => {
    // Self-edges (subject === related) are prevented by the import's query
    // guards, not by the table; skip them so a contact is never listed as
    // its own guardian/recipient.
    if (owner === other) return
    const name = names.get(other)
    if (!name) return
    const list = result.get(owner) ?? []
    if (list.some((r) => r.contactCode === other && r.role === role)) return
    list.push({ contactCode: other, role, ...name })
    result.set(owner, list)
  }

  // Counts per direction: an edge requested from both sides whose
  // counterparts are both missing counts twice.
  let droppedDirections = 0
  for (const r of trimmedRows) {
    if (requested.has(r.subject)) {
      if (names.has(r.related)) {
        push(r.subject, r.related, SUBJECT_ROLE[r.roleType])
      } else {
        droppedDirections++
      }
    }
    if (requested.has(r.related)) {
      if (names.has(r.subject)) {
        push(r.related, r.subject, RELATED_ROLE[r.roleType])
      } else {
        droppedDirections++
      }
    }
  }
  if (droppedDirections > 0) {
    logger.debug(
      { droppedDirections, requested: requested.size },
      'relatedContactsForMany.missingInXpand'
    )
  }

  return result
}

/**
 * Related contacts for one code; `[]` both for an unknown contact and for
 * one with no relations — existence is checked separately via
 * `contactExists`.
 */
const relatedContactsFor = async (
  xpandDb: Knex,
  contactsDb: Knex,
  contactCode: ContactCode
): Promise<RelatedContact[]> =>
  (await relatedContactsForMany(xpandDb, contactsDb, [contactCode])).get(
    contactCode.trim()
  ) ?? []

export { relatedContactsFor, relatedContactsForMany }
