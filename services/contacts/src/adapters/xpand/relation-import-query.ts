import { Knex } from 'knex'
import { RelationEdge, RoleType } from '@src/adapters/contact-relations'
import {
  ADMINISTRATOR_FORVTYP,
  ANNANFM,
  currentRelation,
  GUARDIAN_FORVTYPS,
  GuardianForvtyp,
  INNEHAVARE,
  RENSAD_GDPR,
  TRUSTEE_FORVTYP,
} from './relation-sql'

/**
 * One current invoice recipient (an ANNANFM row or a c/o addressee) on one of
 * the holder's active leases. Several rows per holder are normal (one per
 * lease, one per source); collapsing happens in the import script. `leaseKey` identifies the lease; `leaseId` is the operator-facing
 * label that goes into the conflict report.
 */
export type InvoiceRecipientCandidate = {
  holderContactCode: string
  recipientContactCode: string
  leaseKey: string
  leaseId: string
}

const ROLE_BY_FORVTYP: Record<GuardianForvtyp, RoleType> = {
  [TRUSTEE_FORVTYP]: 'god_man',
  [ADMINISTRATOR_FORVTYP]: 'forvaltare',
}

type GuardianRow = {
  subjectCode: string
  relatedCode: string
  forvtyp: GuardianForvtyp
}

/**
 * Every god man / förvaltare relation in Xpand: `subject.keycmctc2` points at
 * the guardian; the ward's `forvtyp` decides the role. Excludes
 * `subject.keycmctc2 = subject.keycmctc` (a contact set as their own
 * guardian), which is bad data and would otherwise become a self-edge.
 */
export const allGuardianEdges = async (db: Knex): Promise<RelationEdge[]> => {
  const rows: GuardianRow[] = await db('cmctc as subject')
    .innerJoin('cmctc as related', 'subject.keycmctc2', 'related.keycmctc')
    .whereIn('subject.forvtyp', [...GUARDIAN_FORVTYPS])
    .whereRaw('subject.keycmctc <> subject.keycmctc2')
    .whereRaw('TRIM(subject.cmctckod) <> ?', [RENSAD_GDPR])
    .whereRaw('TRIM(related.cmctckod) <> ?', [RENSAD_GDPR])
    .select(
      'subject.cmctckod as subjectCode',
      'related.cmctckod as relatedCode',
      'subject.forvtyp as forvtyp'
    )
    // Duplicate cmctc rows can give one subject a guardian edge in each role,
    // and only one of them can be written. Without an order the engine picks,
    // so a fresh import could seat a different guardian than the last one.
    .orderBy('subject.cmctckod')
    .orderBy('subject.forvtyp')
    .orderBy('related.cmctckod')

  return rows.map((r) => ({
    subjectContactCode: r.subjectCode.trim(),
    relatedContactCode: r.relatedCode.trim(),
    roleType: ROLE_BY_FORVTYP[r.forvtyp],
  }))
}

type CandidateRow = {
  holderCode: string
  recipientCode: string
  leaseKey: string
  leaseLabel: string | null
}

/**
 * Every (holder, recipient, lease) triple where the holder currently holds an
 * active lease (`hyobj.sistadeb IS NULL`) that has a current ANNANFM row.
 * Excludes `ten.keycmctc = fm.keycmctc` (a contact listed as their own invoice
 * recipient), which is bad data and would otherwise become a false conflict.
 * Duplicate triples are expected (co-tenants, overlapping rows) and are
 * deduped by the collapse and reconcile steps.
 */
export const allInvoiceRecipientCandidates = async (
  db: Knex,
  now: Date
): Promise<InvoiceRecipientCandidate[]> => {
  const [tenFrom, tenTo] = currentRelation(db, 'ten', now)
  const [fmFrom, fmTo] = currentRelation(db, 'fm', now)

  const rows: CandidateRow[] = await db('hyobj as o')
    .innerJoin('hyavk as ten', function () {
      this.on('ten.keyhyobj', 'o.keyhyobj')
        .andOn(db.raw('TRIM(ten.keyhyakt) = ?', [INNEHAVARE]))
        .andOn(tenFrom)
        .andOn(tenTo)
    })
    .innerJoin('hyavk as fm', function () {
      this.on('fm.keyhyobj', 'o.keyhyobj')
        .andOn(db.raw('TRIM(fm.keyhyakt) = ?', [ANNANFM]))
        .andOn(fmFrom)
        .andOn(fmTo)
    })
    .innerJoin('cmctc as holder', 'holder.keycmctc', 'ten.keycmctc')
    .innerJoin('cmctc as recipient', 'recipient.keycmctc', 'fm.keycmctc')
    .whereNull('o.sistadeb')
    .whereRaw('ten.keycmctc <> fm.keycmctc')
    .whereRaw('TRIM(holder.cmctckod) <> ?', [RENSAD_GDPR])
    .whereRaw('TRIM(recipient.cmctckod) <> ?', [RENSAD_GDPR])
    .select(
      'holder.cmctckod as holderCode',
      'recipient.cmctckod as recipientCode',
      'o.keyhyobj as leaseKey',
      'o.hyobjben as leaseLabel'
    )

  return rows.map((r) => ({
    holderContactCode: r.holderCode.trim(),
    recipientContactCode: r.recipientCode.trim(),
    leaseKey: r.leaseKey.trim(),
    // The label is what verksamheten calls the lease, but it is not a key and
    // legacy rows may have none; identity always comes from leaseKey.
    leaseId: (r.leaseLabel ?? '').trim(),
  }))
}

type CoAddresseeRow = {
  holderCode: string
  coCode: string
  leaseKey: string
  leaseLabel: string | null
}

/**
 * Every (holder, c/o addressee, lease) triple on the current invoice period
 * of an active lease. The c/o addressee on the lease's invoice settings
 * (`hyfak.keycmctc3`) counts as an annan fakturamottagare for the contact the
 * invoice row belongs to (`hyfak.keycmctc`), whether that addressee is a god
 * man, förvaltare or anyone else. Excludes a contact set as their own c/o.
 */
export const allCoAddresseeCandidates = async (
  db: Knex,
  now: Date
): Promise<InvoiceRecipientCandidate[]> => {
  const [periodFrom, periodTo] = currentRelation(db, 'r', now)

  const rows: CoAddresseeRow[] = await db('hyobj as o')
    .innerJoin('hyrep as r', function () {
      this.on('r.keyhyobj', 'o.keyhyobj').andOn(periodFrom).andOn(periodTo)
    })
    .innerJoin('hyfak as f', 'f.keyhyrep', 'r.keyhyrep')
    .innerJoin('cmctc as holder', 'holder.keycmctc', 'f.keycmctc')
    .innerJoin('cmctc as co', 'co.keycmctc', 'f.keycmctc3')
    .whereNull('o.sistadeb')
    .whereRaw('f.keycmctc <> f.keycmctc3')
    .whereRaw('TRIM(holder.cmctckod) <> ?', [RENSAD_GDPR])
    .whereRaw('TRIM(co.cmctckod) <> ?', [RENSAD_GDPR])
    .select(
      'holder.cmctckod as holderCode',
      'co.cmctckod as coCode',
      'o.keyhyobj as leaseKey',
      'o.hyobjben as leaseLabel'
    )

  return rows.map((r) => ({
    holderContactCode: r.holderCode.trim(),
    recipientContactCode: r.coCode.trim(),
    leaseKey: r.leaseKey.trim(),
    leaseId: (r.leaseLabel ?? '').trim(),
  }))
}
