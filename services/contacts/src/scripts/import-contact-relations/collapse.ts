import { RelationEdge } from '@src/adapters/contact-relations'
import { InvoiceRecipientCandidate } from '@src/adapters/xpand/relation-import-query'

/**
 * A holder whose active leases point at more than one distinct recipient.
 * Cannot be represented at contact level; reported for manual handling.
 */
export type Conflict = {
  holderContactCode: string
  recipients: { contactCode: string; leaseIds: string[] }[]
}

const ascending = (a: string, b: string) => a.localeCompare(b)

/**
 * Collapses Xpand's per-lease annan fakturamottagare rows to contact level:
 * one edge per holder when every lease agrees on the recipient, otherwise a
 * conflict. Output is sorted by holder code, and within a conflict by
 * recipient code and lease id, for deterministic reports.
 */
export const collapseInvoiceRecipients = (
  candidates: InvoiceRecipientCandidate[]
): { edges: RelationEdge[]; conflicts: Conflict[] } => {
  const byHolder = new Map<string, Map<string, Set<string>>>()

  for (const c of candidates) {
    const recipients =
      byHolder.get(c.holderContactCode) ?? new Map<string, Set<string>>()
    const leases = recipients.get(c.recipientContactCode) ?? new Set<string>()
    leases.add(c.leaseId)
    recipients.set(c.recipientContactCode, leases)
    byHolder.set(c.holderContactCode, recipients)
  }

  const edges: RelationEdge[] = []
  const conflicts: Conflict[] = []

  for (const [holder, recipients] of [...byHolder.entries()].sort(([a], [b]) =>
    ascending(a, b)
  )) {
    if (recipients.size === 1) {
      const [recipient] = recipients.keys()
      edges.push({
        subjectContactCode: holder,
        relatedContactCode: recipient,
        roleType: 'annan_fakturamottagare',
      })
    } else {
      conflicts.push({
        holderContactCode: holder,
        recipients: [...recipients.entries()]
          .sort(([a], [b]) => ascending(a, b))
          .map(([contactCode, leaseIds]) => ({
            contactCode,
            leaseIds: [...leaseIds].sort(ascending),
          })),
      })
    }
  }

  return { edges, conflicts }
}
