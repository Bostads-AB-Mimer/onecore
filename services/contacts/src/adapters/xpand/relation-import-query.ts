import knex from 'knex'
import { RelationEdge, RoleType } from '@src/adapters/contact-relations'

/**
 * One current ANNANFM row on one of the holder's active leases. Several rows
 * per holder are normal (one per lease); collapsing happens in the import
 * script.
 */
export type InvoiceRecipientCandidate = {
  holderContactCode: string
  recipientContactCode: string
  leaseId: string
}

const RENSAD_GDPR = 'RENSAD_GDPR'
const INNEHAVARE = 'INNEHAVARE'
const ANNANFM = 'ANNANFM'

// forvtyp on the ward's cmctc row: 1 = god man, 2 = förvaltare.
const ROLE_BY_FORVTYP: Record<number, RoleType> = {
  1: 'god_man',
  2: 'forvaltare',
}

type GuardianRow = {
  subjectCode: string
  relatedCode: string
  forvtyp: number
}

/**
 * Every god man / förvaltare relation in Xpand: `subject.keycmctc2` points at
 * the guardian; the ward's `forvtyp` decides the role.
 */
export const allGuardianEdges = async (
  db: knex.Knex
): Promise<RelationEdge[]> => {
  const rows: GuardianRow[] = await db('cmctc as subject')
    .innerJoin('cmctc as related', 'subject.keycmctc2', 'related.keycmctc')
    .whereIn('subject.forvtyp', Object.keys(ROLE_BY_FORVTYP).map(Number))
    .whereNot('subject.cmctckod', RENSAD_GDPR)
    .whereNot('related.cmctckod', RENSAD_GDPR)
    .select(
      'subject.cmctckod as subjectCode',
      'related.cmctckod as relatedCode',
      'subject.forvtyp as forvtyp'
    )

  return rows.map((r) => ({
    subjectContactCode: r.subjectCode.trim(),
    relatedContactCode: r.relatedCode.trim(),
    roleType: ROLE_BY_FORVTYP[r.forvtyp],
  }))
}

type CandidateRow = {
  holderCode: string
  recipientCode: string
  leaseId: string
}

/**
 * Every (holder, recipient, lease) triple where the holder currently holds an
 * active lease (`hyobj.sistadeb IS NULL`) that has a current ANNANFM row.
 * "Current" treats NULL fdate/tdate as unbounded (legacy ANNANFM rows often
 * have NULL fdate). Collapsing to contact level happens in the caller.
 */
export const allInvoiceRecipientCandidates = async (
  db: knex.Knex,
  now: Date
): Promise<InvoiceRecipientCandidate[]> => {
  const rows: CandidateRow[] = await db('hyobj as o')
    .innerJoin('hyavk as ten', function () {
      this.on('ten.keyhyobj', 'o.keyhyobj')
        .andOnVal('ten.keyhyakt', INNEHAVARE)
        .andOn(db.raw('(ten.fdate IS NULL OR ten.fdate <= ?)', [now]))
        .andOn(db.raw('(ten.tdate IS NULL OR ten.tdate >= ?)', [now]))
    })
    .innerJoin('hyavk as fm', function () {
      this.on('fm.keyhyobj', 'o.keyhyobj')
        .andOnVal('fm.keyhyakt', ANNANFM)
        .andOn(db.raw('(fm.fdate IS NULL OR fm.fdate <= ?)', [now]))
        .andOn(db.raw('(fm.tdate IS NULL OR fm.tdate >= ?)', [now]))
    })
    .innerJoin('cmctc as holder', 'holder.keycmctc', 'ten.keycmctc')
    .innerJoin('cmctc as recipient', 'recipient.keycmctc', 'fm.keycmctc')
    .whereNull('o.sistadeb')
    .whereNot('holder.cmctckod', RENSAD_GDPR)
    .whereNot('recipient.cmctckod', RENSAD_GDPR)
    .select(
      'holder.cmctckod as holderCode',
      'recipient.cmctckod as recipientCode',
      'o.hyobjben as leaseId'
    )

  return rows.map((r) => ({
    holderContactCode: r.holderCode.trim(),
    recipientContactCode: r.recipientCode.trim(),
    leaseId: r.leaseId.trim(),
  }))
}
