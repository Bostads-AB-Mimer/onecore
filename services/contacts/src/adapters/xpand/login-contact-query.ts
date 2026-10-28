import { Knex } from 'knex'
import { LoginContactCandidate } from '@src/domain/login-contact'
import { NationalIdForms } from '@src/domain/national-id'
import { NORMALISED_NATIONAL_ID_SQL } from './query'
import { INNEHAVARE, RENSAD_GDPR } from './relation-sql'

type CandidateRow = {
  contactCode: string
  currentTenant: number
  queueTime: number
  xpandUser: number
  createdAt: Date | null
}

/**
 * Every contact a person could log in as: private individuals (P codes) with
 * the given personnummer in either stored form, not deleted.
 *
 * A sole trader's company contact carries the same number but is a separate
 * customer, so only P codes are candidates.
 *
 * A lease counts while it is still running, also when notice has been given
 * (`sistadeb` in the future): that tenant still lives there. This is wider
 * than the relation import, which only reads leases without notice.
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
      'cmctc.createdate as createdAt',
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
      )
    )

  return rows.map((r) => ({
    contactCode: r.contactCode.trim(),
    currentTenant: r.currentTenant === 1,
    queueTime: r.queueTime === 1,
    xpandUser: r.xpandUser === 1,
    createdAt: r.createdAt,
  }))
}
