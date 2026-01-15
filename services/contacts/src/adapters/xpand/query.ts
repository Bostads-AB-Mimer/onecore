import knex from 'knex'
import { Pagination } from '@src/adapters'
import { ContactCode, NationalIdNumber } from '@src/domain'
import { ContactTypeFilter, ObjectKey } from '@src/domain/contact'

import { DbContactRow } from './db-model'

const CONTACT_CODE = 'cmctc.cmctckod'
const NATIONAL_ID_NUMBER = 'cmctc.persorgnr'

/**
 * Utility-function that generates the arguments for knex.whereRaw
 * for case-insensitive and accent-insensitive wildcard WHERE-criteria.
 *
 * Usage:
 * <knex-builder>.whereRaw(...wildcard('knut'))
 *
 * @param column - The column name to apply the wildcard search on
 * @param wc - The wildcard string to search for
 *
 * @returns A tuple where the first element is the raw SQL string
 *          and the second element is an array of bindings
 */
const wildcard = (column: string, wc: string): [string, string[]] => [
  `${column} COLLATE Latin1_General_100_CI_AI LIKE ?`,
  [`%${wc}%`],
]

/**
 * Utility-function that generates the arguments for knex.whereRaw
 * for WHERE-criteria of the type `<column> IN (...)` where both
 * the column and the values are trimmed of leading and trailing
 * whitespace.
 *
 * @param column - The column name to apply the IN-criteria on
 * @param inList - The list of values for the IN-criteria
 *
 * @returns A tuple where the first element is the raw SQL string
 */
const trimInCriteria = (
  column: string,
  inList: string[]
): [string, string[]] => [
  `TRIM(${column}) IN (${Array(inList.length).fill('?').join(', ')})`,
  inList.map((v) => v.trim()),
]

/**
 * This allows lookup by phone number despite the poor data quality
 * of `cmtel`.`cmtelben`.
 *
 * It is non-indexable and will require a full-table scan with a
 * transformatio applied to each row for every query, but the assumption
 * is that we can live with this evil during the transitional period
 * until the contacts master data is moved to a ONECore database,
 * and preferrably one not designed by crack-smoking aardvarks.
 *
 * The concept is otherwise simple, but implemented with SQL Servers
 * dodgy text-transformation built-ins.
 *
 * TRANSLATE can of course only be told what to replace, not what to
 * keep, so we'll have to list every single character we want to remove
 * and replace that with a whitespace. Because TRANSLATE also needs a
 * counterpart for each character, we need an empty string of the same
 * length as the character list-string, so we generate that with
 * REPLICATE.
 *
 * Then we can use REPLACE to simple remove all occurrences of ' ' by
 * replacing them with ''. True story.
 *
 * If this causes something to catch actual fire, don't call me. You'll
 * never find me.
 *
 * FIXME:
 * If this ends up surviving itself, we may want to consider creating
 * a shadow table of `cmtel` with cleaned phone numbers in a ONECore
 * database and periodically re-import and clean the data.
 * Or any equivalent cache/lookup table that removes the burden from the
 * database.
 */
const PHONE_NUMBER_TRANSFORMATION_SQL = `
REPLACE(
  TRANSLATE(
    cmtelben,
    '+-(): /._abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
   REPLICATE(' ', 61)
  ),
  ' ',
  ''
)`

/**
 * Constructs a base query for selecting rows from `cmtel`
 * in the shape of DbPhoneNumber.
 */
const phoneNumbersQuery = (db: knex.Knex) =>
  db
    .from('cmtel')
    .select(
      'keycmobj as ownerObjectKey',
      'cmtelben as phoneNumber',
      'keycmtet as type',
      'main as isPrimary'
    )

/**
 * Finds contact object keys for contacts that have the given
 * phone number.
 *
 * Because of the data-quality of `cmtel` this is slower than
 * a hungover badger on easter day, as it requires
 * text-manipulation `cmtelben` for each and every row of the
 * table.
 *
 * @see PHONE_NUMBER_TRANSFORMATION_SQL
 *
 * @param db - The Knex database connection to use
 * @param phoneNumber - The phone number to search for
 * @returns A promise that resolves to an array of ObjectKeys
 */
export const contactObjectKeysForPhoneNumber = async (
  db: knex.Knex,
  phoneNumber: string
): Promise<ObjectKey[]> => {
  return (
    await phoneNumbersQuery(db).whereRaw(
      `${PHONE_NUMBER_TRANSFORMATION_SQL} = ?`,
      [phoneNumber]
    )
  ).map(({ ownerObjectKey }) => ownerObjectKey)
}

/**
 * Fluent query builder for contacts, tailored to the requirements
 * of the Contacts repository, and thus supports those and absolutely
 * nothing else.
 *
 * Queries are executed with either:
 * `getPage` - lists all matches within the bounds of the set pagination,
 *             if any.
 * `getOne` - returns the first match, if any.
 *
 * The queries produced by this builder yield a denormalized join result,
 * a k a "row explosion". This means that for each successfully joined
 * address, email or phone number for a contact, that contact is repeated
 * in the result set for each combination of joined contact details.
 *
 * Pagination is applied pre-join through set-based candidate selection,
 * with hydration happening after the pagination offset has been applied
 * to the set.
 *
 * See the implementation of `getPage` for more details.
 *
 * @returns An object with methods for building and executing
 *          contact queries.
 */
export const contactsQuery = () => {
  const wheres: Record<string, any> = {}
  let pagination: Pagination = { page: 0, pageSize: 20 }
  let wildcards: string[] = []
  let contactType: ContactTypeFilter = 'any'
  let objectKeyFilter: ContactCode[] = []

  return {
    /**
     * Adds a WHERE-criteria for single contact code.
     */
    hasContactCode(contactCode: ContactCode) {
      wheres[CONTACT_CODE] = contactCode
      return this
    },

    /**
     * Adds a WHERE-criteria for multiple object keys.
     */
    withObjectKeyIn(objectKeys: ObjectKey[]) {
      objectKeyFilter = objectKeys
      return this
    },

    /**
     * Adds a WHERE-criteria for single national ID number.
     */
    hasNationalId(nid: NationalIdNumber) {
      wheres[NATIONAL_ID_NUMBER] = nid
      return this
    },

    /**
     * Adds a WHERE-criteria for contact type.
     *
     * This is an artifical criteria, and is based on the
     * leading character of the contact code and some dodgy
     * characteristics of contact codes that do not follow
     * that idiom.
     */
    isContactType(type: ContactTypeFilter) {
      contactType = type
      return this
    },

    /**
     * Adds any number of wildcard search strings.
     */
    wildcard(wildcard?: string | string[]) {
      if (wildcard) {
        wildcards = Array.isArray(wildcard) ? wildcard : [wildcard]
      }
      return this
    },

    /**
     * Sets pagination details in the form of page number and
     * page size.
     */
    paginate({ page, pageSize }: Pagination) {
      pagination = { page, pageSize }
      return this
    },

    /**
     * Constructs and executes the query according the builder state and returns
     * a list of all resulting rows.
     *
     * -
     *
     * The result set produced by this function is a denormalized, exploded join
     * of all related entities. Each row represents one combination of:
     *
     * - cmctc: The base contact details table
     * - cmadr: Adresses
     * - cmeml: Email adresses
     * - cmtel: Phone numbers
     *
     * In relational terms:
     *
     *   cmctc 1 ---< N cmadr
     *   cmctc 1 ---< N cmeml
     *   cmctc 1 ---< N cmtel
     *
     * Because of these 1-to-N relationships, the join's produce a
     * fan-out/row explosion/denormalized projection/call-it-whatcha-want.
     * The responsibility of collapsing the rows into coherent contacts is
     * left to the application code.
     *
     * The guarantee is that regardless of how many rows the query returns,
     * the number of unique contacts yielded are equal to the pagination page
     * size (or less, if there are not enough matches).
     *
     * ---
     *
     * In order to avoid multiple round-trips to the database and preserve
     * pagination semantics over `cmctc` even though the resultset is a
     * denormalized join result of unknown length, a candidate set is first
     * selected using a sub-query.
     *
     * If wildcard criterias are used, this sub-query is in itself union:ed
     * sub-selects, and if multiple wildcards are specified those union:ed
     * queries are in turn intersected.
     *
     * -------------------------
     * If no wildcards are used:
     * -------------------------
     * WITH page AS (
     *   SELECT keycmobj FROM <cmctc with base criteria>
         <OFFSET/FETCH pagination>
     * )
     * SELECT ... FROM page JOIN <cmctc, cmadr, cmeml, cmtel>
     *
     * --------------------------------
     * If exactly one wildcard is used:
     * --------------------------------
     * WITH page AS (
     *   SELECT DINSTINCT keycmobj FROM (
     *     SELECT ... FROM cmctc WHERE <crit>
     *     UNION
     *     SELECT FROM cmadr, cmctc WHERE <crit>)
     *   )
     *   <OFFSET/FETCH pagination>
     * )
     * SELECT ... FROM page JOIN <cmctc, cmadr, cmeml, cmtel>
     *
     * ----------------------------------
     * If two or more wildcards are used:
     * ----------------------------------
     * WITH page AS (
     *   SELECT DINSTINCT keycmobj FROM (
     *     (
     *        SELECT ... FROM cmctc WHERE <crit>
     *        UNION
     *        SELECT FROM cmadr, cmctc WHERE <crit>)
     *     )
     *     INTERSECT
     *     (
     *        SELECT ... FROM cmctc WHERE <crit>
     *        UNION
     *        SELECT FROM cmadr, cmctc WHERE <crit>)
     *     )
     *     INTERSECT
     *     ...
     *   )
     *   <OFFSET/FETCH pagination>
     * )
     * SELECT ... FROM page JOIN <cmctc, cmadr, cmeml, cmtel>
     *
     * ----
     *
     *
     * In short:
     * - UNION expresses OR semantics within one wildcard
     * - INTERSECT expresses AND semantics between multiple wildcards
     * - DISTINCT removes duplicate contact IDs before pagination
     *
     * This allows:
     * - Correct pagination over cmctc
     * - Efficient wildcard searching
     * - Fetching all joined contact details within a single
     *   database round-trip
     *
     * I guess that clears up any and all question marks, so we'll just
     * skip the Q&A session and head out for lunch, then?
     *
     *
     * @param db - The Knex database connection to use
     * @param queryPagination - Optional override of pagination set
     *                          on builder.
     *
     * @returns A promise that resolves to an array of DbContact
     */
    async getPage(
      db: knex.Knex,
      queryPagination?: Pagination
    ): Promise<DbContactRow[]> {
      /**
       * Local utility function that applies the base cmctc-only
       * criteria/filters to a knex query-builder selecting from
       * `cmctc`.
       *
       * @param qb - The select-in-progress knex query-builder.
       */
      const baseFilters = (qb: knex.Knex.QueryBuilder) => {
        qb.whereNot('cmctc.cmctckod', null)

        if (contactType === 'organisation') {
          qb.andWhere((b) => {
            b.orWhereLike('cmctc.cmctckod', 'F%').orWhere((edge) =>
              edge
                .whereRaw("LEFT(cmctc.cmctckod, 1) LIKE '[0-9]'")
                .andWhere('fnamn', null)
            )
          })
        } else if (contactType == 'individual') {
          qb.andWhere((b) => {
            b.orWhereLike('cmctc.cmctckod', 'P%').orWhere((edge) =>
              edge
                .whereRaw("LEFT(cmctckod, 1) LIKE '[0-9]'")
                .andWhereNot('cmctc.fnamn', null)
            )
          })
        }

        if (objectKeyFilter.length) {
          qb.andWhereRaw(...trimInCriteria('cmctc.keycmobj', objectKeyFilter))
        }

        if (Object.keys(wheres).length) {
          qb.andWhere(wheres)
        }
      }

      /**
       * Constructs a union:ed sub-query for a single wildcard
       * search string.
       *
       * Queries that use multiple wildcards will call this function
       * once for each wildcard.
       *
       * @param wc - The wildcard string to search for
       */
      const wildcardUnion = (wc: string) => {
        const cmctcPart = db
          .select('keycmobj')
          .from('cmctc')
          .modify(baseFilters)
          .andWhere((b) =>
            b
              .whereRaw(...wildcard('fnamn', wc))
              .orWhereRaw(...wildcard('enamn', wc))
              .orWhereRaw(...wildcard('cmctcben', wc))
          )

        const cmadrPart = db
          .select({ keycmobj: 'cmadr.keycode' })
          .from('cmadr')
          .join('cmctc', 'cmadr.keycode', 'cmctc.keycmobj')
          .modify(baseFilters)
          .whereNull('cmadr.tdate')
          .andWhere((b) =>
            b
              .whereRaw(...wildcard('cmadr.adress1', wc))
              .orWhereRaw(...wildcard('cmadr.adress2', wc))
              .orWhereRaw(...wildcard('cmadr.adress3', wc))
              .orWhereRaw(...wildcard('cmadr.adress4', wc))
              .orWhereRaw(...wildcard('cmadr.adress5', wc))
              .orWhereRaw(...wildcard('cmadr.adress6', wc))
              .orWhereRaw(...wildcard('cmadr.adress7', wc))
              .orWhereRaw(...wildcard('cmadr.adress8', wc))
              .orWhereRaw(...wildcard('cmadr.adress9', wc))
              .orWhereRaw(...wildcard('cmadr.adress10', wc))
          )

        return cmctcPart.unionAll([cmadrPart])
      }

      const query = db
        .with('page', (pg) => {
          if (wildcards.length === 0) {
            pg.select('keycmobj').from('cmctc').modify(baseFilters)
          } else {
            const [wc, ...rest] = wildcards

            const unionBase = wildcardUnion(wc)
            rest.forEach((nextWc) => {
              unionBase.intersect(wildcardUnion(nextWc))
            })

            pg.distinct('keycmobj').from(unionBase.as('candidates'))
          }

          const pgn = queryPagination ?? pagination

          pg.orderBy('keycmobj')
            .offset(pgn.page * pgn.pageSize)
            .limit(pgn.pageSize)
        })
        .from('page')
        .join('cmctc', 'cmctc.keycmobj', 'page.keycmobj')
        .leftJoin('cmadr', (join) => {
          join.on('cmadr.keycode', 'cmctc.keycmobj').andOnNull('cmadr.tdate')
        })
        .leftJoin('cmeml', 'cmeml.keycmobj', 'cmctc.keycmobj')
        .leftJoin('cmtel', 'cmtel.keycmobj', 'cmctc.keycmobj')
        .select(
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
          'cmeml.keycmeml as emailId',
          'cmeml.cmemlben as emailAddress',
          'cmeml.main as isPrimaryEmail',
          'cmtel.keycmtel as phoneId',
          'cmtel.cmtelben as phoneNumber',
          'cmtel.keycmtet as phoneType',
          'cmtel.main as isPrimaryPhone'
        )

      return await query
    },

    /**
     * Executes the query and returns the denormalized rows (see doc-comment
     * for `getPage` for a single Contact matching the query criteria.
     *
     * @param db - The Knex database connection to use
     *
     * @returns A promise that resolves to a single DbContact
     */
    async getOne(db: knex.Knex): Promise<DbContactRow[]> {
      return this.getPage(db, {
        page: 0,
        pageSize: 1,
      })
    },
  }
}
