import knex from 'knex'
import { ContactCode } from '@src/domain'
import { currentInvoiceAddress } from './address-sql'
import { DbContactRow } from './db-model'
import { isLeaseHolderColumn, LEASE_HOLDER } from './relation-sql'

export type ContactIncludeOptions = {
  includePhone?: boolean
  includeEmail?: boolean
  includeAddress?: boolean
  includeRelations?: boolean
}

const BASE_COLUMNS = [
  'cmctc.cmctckod as contactCode',
  'cmctc.fnamn as firstName',
  'cmctc.enamn as lastName',
  'cmctc.cmctcben as fullName',
  'cmctc.persorgnr as nid',
  'cmctc.birthdate as birthDate',
  'cmctc.keycmobj as objectKey',
  'cmctc.keycmctc as contactKey',
  'cmctc.lagsokt as protectedIdentity',
  'cmctc.utslag as specialAttention',
]

const ADDRESS_COLUMNS = [
  'cmadr.keycmadr as addressId',
  'cmadr.region',
  'cmadr.adress1',
  'cmadr.adress2',
  'cmadr.adress3',
  'cmadr.adress4',
  'cmadr.adress5',
  'cmadr.adress6',
  'cmadr.adress7',
  'cmadr.adress8',
  'cmadr.adress9',
  'cmadr.adress10',
]

const EMAIL_COLUMNS = [
  'cmeml.keycmeml as emailId',
  'cmeml.cmemlben as emailAddress',
  'cmeml.main as isPrimaryEmail',
]

const PHONE_COLUMNS = [
  'cmtel.keycmtel as phoneId',
  'cmtel.cmtelben as phoneNumber',
  'cmtel.keycmtet as phoneType',
  'cmtel.main as isPrimaryPhone',
]

/**
 * Lean batch lookup of contacts by exact contact code. Selects only base
 * `cmctc` columns by default — no row explosion.
 * Each `include*` flag adds the corresponding left-join and its columns.
 *
 * Composable: other endpoints can adopt this builder later to gain an
 * include-flag opt-out from the always-joining `contactsQuery()`.
 */
export const contactsByCodesQuery = async (
  db: knex.Knex,
  contactCodes: ContactCode[],
  options: ContactIncludeOptions = {}
): Promise<DbContactRow[]> => {
  const trimmed = contactCodes.map((c) => c.trim())
  const placeholders = trimmed.map(() => '?').join(', ')

  // The code filter lives in the CTE and the join to it narrows `cmctc`, so
  // the codes are bound once (MSSQL's 2100-parameter cap).
  let query = db
    .with(LEASE_HOLDER, (lh) => {
      lh.select('cmctc.keycmctc', isLeaseHolderColumn(db, new Date()))
        .from('cmctc')
        .whereRaw(`TRIM(cmctc.cmctckod) IN (${placeholders})`, trimmed)
    })
    .from(LEASE_HOLDER)
    .join('cmctc', 'cmctc.keycmctc', `${LEASE_HOLDER}.keycmctc`)

  const columns = [...BASE_COLUMNS, `${LEASE_HOLDER}.isLeaseHolder`]

  if (options.includeAddress) {
    query = query.leftJoin('cmadr', (join) => {
      join
        .on('cmadr.keycode', 'cmctc.keycmobj')
        .andOn(currentInvoiceAddress(db))
    })
    columns.push(...ADDRESS_COLUMNS)
  }
  if (options.includeEmail) {
    query = query.leftJoin('cmeml', 'cmeml.keycmobj', 'cmctc.keycmobj')
    columns.push(...EMAIL_COLUMNS)
  }
  if (options.includePhone) {
    query = query.leftJoin('cmtel', 'cmtel.keycmobj', 'cmctc.keycmobj')
    columns.push(...PHONE_COLUMNS)
  }

  return query.select(columns)
}
