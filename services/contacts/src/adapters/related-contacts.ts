import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import { ContactCode } from '@src/domain'
import { RelatedContact, RelatedContactRole } from '@src/domain/contact'
import { contactNamesByCodes } from '@src/adapters/xpand/contact-lookup-query'
import {
  activeRelationsForMany,
  activeRelationsInRole,
  RelationDirection,
  ROLE_TYPES,
  RoleType,
} from '@src/adapters/contact-relations'

const DIRECTIONS: RelationDirection[] = ['subject', 'related']

// The role a contact sees for a row, given which side of the edge it is on.
// A subject is the huvudman / lease holder; a related contact is the
// guardian / recipient.
const ROLES: Record<RoleType, Record<RelationDirection, RelatedContactRole>> = {
  god_man: { subject: 'trustee', related: 'trusteeFor' },
  forvaltare: { subject: 'administrator', related: 'administratorFor' },
  annan_fakturamottagare: {
    subject: 'otherInvoiceRecipient',
    related: 'otherInvoiceRecipientFor',
  },
}

// Inverse of ROLES, derived so the two cannot drift apart.
const ROLE_SPECS = Object.fromEntries(
  ROLE_TYPES.flatMap((roleType) =>
    DIRECTIONS.map((direction) => [
      ROLES[roleType][direction],
      { roleType, direction },
    ])
  )
) as Record<
  RelatedContactRole,
  { roleType: RoleType; direction: RelationDirection }
>

/** One side of one relation, from the perspective of `owner`. */
type Edge = { owner: string; other: string; role: RelatedContactRole }

/**
 * Turns edges into RelatedContact lists keyed by owner, taking names and
 * protected-identity redaction from Xpand `cmctc`. Drops self-edges, edges
 * whose counterpart no longer exists in Xpand, and repeats of the same
 * (contactCode, role) pair. Owners left with nothing are absent from the map.
 */
const hydrate = async (
  xpandDb: Knex,
  edges: Edge[]
): Promise<Map<string, RelatedContact[]>> => {
  const result = new Map<string, RelatedContact[]>()
  // Self-edges are excluded by the import's queries, not by the table, so a
  // contact could otherwise be listed as its own guardian/recipient.
  const distinct = edges.filter((e) => e.owner !== e.other)
  if (distinct.length === 0) return result

  const names = await contactNamesByCodes(
    xpandDb,
    distinct.map((e) => e.other)
  )

  let dropped = 0
  // Keyed rather than scanned: one role of a high-degree contact can hold
  // thousands of edges, and re-scanning the accumulated list per edge would
  // put back the quadratic cost that filtering in SQL removes.
  const seen = new Set<string>()
  for (const { owner, other, role } of distinct) {
    const name = names.get(other)
    if (!name) {
      dropped++
      continue
    }
    const key = `${owner}|${other}|${role}`
    if (seen.has(key)) continue
    seen.add(key)

    const list = result.get(owner) ?? []
    list.push({ contactCode: other, role, ...name })
    result.set(owner, list)
  }
  if (dropped > 0) {
    logger.debug({ dropped }, 'relatedContacts.missingInXpand')
  }

  return result
}

/**
 * All related contacts for each requested code, keyed by trimmed code.
 * Contacts with no relations are absent from the map (callers default to []).
 */
const relatedContactsForMany = async (
  xpandDb: Knex,
  contactsDb: Knex,
  contactCodes: ContactCode[]
): Promise<Map<string, RelatedContact[]>> => {
  const requested = new Set(
    contactCodes.map((c) => c.trim()).filter((c) => c.length > 0)
  )
  if (requested.size === 0) return new Map()

  const rows = await activeRelationsForMany(contactsDb, [...requested])

  // MSSQL ignores trailing blanks in comparisons, so a stored code can come
  // back padded even though the codes we asked for are trimmed.
  const edges = rows.flatMap((row): Edge[] => {
    const subject = row.subject_contact_code.trim()
    const related = row.related_contact_code.trim()
    const roles = ROLES[row.role_type]
    return [
      ...(requested.has(subject)
        ? [{ owner: subject, other: related, role: roles.subject }]
        : []),
      ...(requested.has(related)
        ? [{ owner: related, other: subject, role: roles.related }]
        : []),
    ]
  })

  return hydrate(xpandDb, edges)
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

/**
 * The contact's related contacts in a single role. Filters by role type and
 * edge direction in SQL rather than reading every relation the contact has,
 * which matters for the high-degree contacts — a municipal fakturamottagare,
 * a professional förvaltare — that the single-role endpoints are asked about.
 */
const relatedContactsInRole = async (
  xpandDb: Knex,
  contactsDb: Knex,
  contactCode: ContactCode,
  role: RelatedContactRole
): Promise<RelatedContact[]> => {
  const owner = contactCode.trim()
  if (owner.length === 0) return []

  const { roleType, direction } = ROLE_SPECS[role]
  const rows = await activeRelationsInRole(
    contactsDb,
    owner,
    roleType,
    direction
  )
  const edges = rows.map((row) => ({
    owner,
    other: (direction === 'subject'
      ? row.related_contact_code
      : row.subject_contact_code
    ).trim(),
    role,
  }))

  return (await hydrate(xpandDb, edges)).get(owner) ?? []
}

export { relatedContactsFor, relatedContactsForMany, relatedContactsInRole }
