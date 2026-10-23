import knex from 'knex'

export const ANNANFM = 'ANNANFM'
export const INNEHAVARE = 'INNEHAVARE'

/** Placeholder contact left behind by a GDPR erasure; never a real party. */
export const RENSAD_GDPR = 'RENSAD_GDPR'

// forvtyp on the ward's cmctc row: 1 = god man, 2 = förvaltare.
export const TRUSTEE_FORVTYP = 1
export const ADMINISTRATOR_FORVTYP = 2
export const GUARDIAN_FORVTYPS = [
  TRUSTEE_FORVTYP,
  ADMINISTRATOR_FORVTYP,
] as const

export type GuardianForvtyp = (typeof GUARDIAN_FORVTYPS)[number]

// Currently-valid relation row, expressed as raw ON predicates. NULL
// fdate/tdate means unbounded validity (legacy ANNANFM rows often have
// NULL fdate).
// knex `raw` predicates are single-use bindings: a fresh pair must be built for
// every query because the same `Raw` instance cannot be reused across `.andOn`
// chains without corrupting its bindings — don't "simplify" by hoisting these.
export const currentRelation = (db: knex.Knex, alias: string, now: Date) => [
  db.raw(`(${alias}.fdate IS NULL OR ${alias}.fdate <= ?)`, [now]),
  db.raw(`(${alias}.tdate IS NULL OR ${alias}.tdate >= ?)`, [now]),
]

/**
 * How long after a lease ends its holder still counts as a tenant, so that a
 * final invoice (slutavisering) can be sent with real name and address.
 */
export const FINAL_INVOICE_GRACE_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Select column `isLeaseHolder`: 1 when the `cmctc` row has a protected
 * identity and is INNEHAVARE on a lease that is current, upcoming, or ended
 * at most FINAL_INVOICE_GRACE_DAYS ago; otherwise 0. Only evaluated for
 * protected identities, since that is the only place the answer is used
 * (to lift redaction — our protected tenants are already anonymised in Xpand).
 * Must be selected in a query that has `cmctc` in scope.
 */
export const isLeaseHolderColumn = (db: knex.Knex, now: Date) => {
  const cutoff = new Date(now.getTime() - FINAL_INVOICE_GRACE_DAYS * DAY_MS)
  return db.raw(
    `CASE WHEN cmctc.lagsokt IS NOT NULL AND EXISTS (
      SELECT 1 FROM hyavk lh
      INNER JOIN hyobj lo ON lo.keyhyobj = lh.keyhyobj
      WHERE lh.keycmctc = cmctc.keycmctc
        AND TRIM(lh.keyhyakt) = ?
        AND (lh.tdate IS NULL OR lh.tdate >= ?)
        AND (lo.sistadeb IS NULL OR lo.sistadeb >= ?)
    ) THEN 1 ELSE 0 END AS isLeaseHolder`,
    [INNEHAVARE, cutoff, cutoff]
  )
}
