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
