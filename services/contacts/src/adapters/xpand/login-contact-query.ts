import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import { LoginContactCandidate } from '@src/domain/login-contact'
import { NationalIdForms, storedCenturyMatches } from '@src/domain/national-id'
import { NORMALISED_NATIONAL_ID_SQL } from './query'
import { INNEHAVARE, RENSAD_GDPR } from './relation-sql'

/** cmrol key of the role captioned Leverantör (supplier). */
export const SUPPLIER_ROLE = '_0DE0O1STV'

/**
 * cmrol key of the role captioned Sökande (applicant). Its `croused` flag is
 * what Xpand reports as the applicant's IsActive, and what login requires.
 */
export const APPLICANT_ROLE = '_0DE0O2500'

type CandidateRow = {
  contactCode: string
  storedNationalId: string
  /** `YYYY-MM-DD`, or null. */
  birthDate: string | null
  supplierOnly: number
  currentTenant: number
  queueTime: number
  xpandUser: number
  isActive: number
  createdAt: Date | null
}

/**
 * Every contact a person could log in as: private individuals (P codes) with
 * the given personnummer in either stored form, not deleted.
 *
 * A sole trader's company contact carries the same number but is a separate
 * customer, so only P codes are candidates.
 *
 * A contact whose only role is Leverantör is one staff created to pay money
 * out to the person. It is still a candidate, so a person with nothing else
 * can log in, but it ranks last.
 *
 * A lease counts while it is still running, also when notice has been given
 * (`sistadeb` in the future): that tenant still lives there. This is wider
 * than the relation import, which only reads leases without notice.
 *
 * Active means the Sökande role is in use. A tenant without that role is not
 * active: being a tenant does not let anyone log in.
 *
 * A contact stored with ten digits matches people born a hundred years apart,
 * so one born in another century is left out (see `storedCenturyMatches`).
 * One whose century can't be told stays a candidate, and is logged. The
 * duplicate check before creating a contact deliberately does not do this:
 * there, a false match is the safe mistake.
 */
export const loginContactCandidates = async (
  db: Knex,
  forms: NationalIdForms,
  now: Date
): Promise<LoginContactCandidate[]> => {
  const rows: CandidateRow[] = await db('cmctc')
    .whereRaw(`${NORMALISED_NATIONAL_ID_SQL} IN (?, ?)`, [
      forms.twelveDigits,
      forms.tenDigits,
    ])
    .where('cmctc.deletemark', 0)
    .whereLike('cmctc.cmctckod', 'P%')
    .whereRaw('TRIM(cmctc.cmctckod) <> ?', [RENSAD_GDPR])
    .select(
      'cmctc.cmctckod as contactCode',
      'cmctc.persorgnr as storedNationalId',
      // Style 23 is YYYY-MM-DD: a plain date, so no timezone gets involved.
      db.raw('CONVERT(char(10), cmctc.birthdate, 23) AS birthDate'),
      'cmctc.createdate as createdAt',
      db.raw(
        `CASE WHEN EXISTS (
           SELECT 1 FROM cmcro r
           WHERE r.keycmctc = cmctc.keycmctc AND TRIM(r.keycmrol) = ?
         ) AND NOT EXISTS (
           SELECT 1 FROM cmcro r
           WHERE r.keycmctc = cmctc.keycmctc AND TRIM(r.keycmrol) <> ?
         ) THEN 1 ELSE 0 END AS supplierOnly`,
        [SUPPLIER_ROLE, SUPPLIER_ROLE]
      ),
      db.raw(
        `CASE WHEN EXISTS (
           SELECT 1 FROM hyavk a
           INNER JOIN hyobj o ON o.keyhyobj = a.keyhyobj
           WHERE a.keycmctc = cmctc.keycmctc
             AND TRIM(a.keyhyakt) = ?
             AND (a.fdate IS NULL OR a.fdate <= ?)
             AND (a.tdate IS NULL OR a.tdate >= ?)
             AND (o.sistadeb IS NULL OR o.sistadeb >= ?)
         ) THEN 1 ELSE 0 END AS currentTenant`,
        [INNEHAVARE, now, now, now]
      ),
      db.raw(
        `CASE WHEN EXISTS (
           SELECT 1 FROM bkqte q WHERE q.keycmctc = cmctc.keycmctc
         ) THEN 1 ELSE 0 END AS queueTime`
      ),
      db.raw(
        `CASE WHEN cmctc.keysyusr IS NULL OR LTRIM(cmctc.keysyusr) = ''
           THEN 0 ELSE 1 END AS xpandUser`
      ),
      db.raw(
        `CASE WHEN EXISTS (
           SELECT 1 FROM cmcro r
           WHERE r.keycmctc = cmctc.keycmctc
             AND TRIM(r.keycmrol) = ?
             AND r.croused = 1
         ) THEN 1 ELSE 0 END AS isActive`,
        [APPLICANT_ROLE]
      )
    )

  const sameCentury = rows.filter((r) => {
    const match = storedCenturyMatches(
      forms.twelveDigits,
      r.storedNationalId,
      r.birthDate
    )
    if (match === 'unknown') {
      // Code only: the personnummer stays out of the logs.
      logger.warn(
        { contactCode: r.contactCode.trim() },
        'loginContactCandidates: ten-digit personnummer without a known century, kept as a candidate'
      )
    }
    return match !== 'different'
  })

  return sameCentury.map((r) => ({
    contactCode: r.contactCode.trim(),
    supplierOnly: r.supplierOnly === 1,
    currentTenant: r.currentTenant === 1,
    queueTime: r.queueTime === 1,
    xpandUser: r.xpandUser === 1,
    isActive: r.isActive === 1,
    createdAt: r.createdAt,
  }))
}
