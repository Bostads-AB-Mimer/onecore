import knex from 'knex'
import { Pagination } from '../contact-adapter'

export const contactsQuery = () => {
  const wheres: Record<string, any> = {}
  let pagination: Pagination | null = null
  let wildcards: string[] = []

  return {
    hasNationalId(nid: string) {
      wheres.persorgnr = nid
      return this
    },

    paginate({ page, pageSize }: Pagination) {
      pagination = { page, pageSize }
      return this
    },

    wildcard(wildcard?: string | string[]) {
      if (wildcard) {
        wildcards = Array.isArray(wildcard) ? wildcard : [wildcard]
      }
      return this
    },

    async execute(db: knex.Knex): Promise<any[]> {
      const query = contactsBaseQuery(db)
      query.where(wheres)

      if (wildcards.length > 0) {
        query.andWhere((b) =>
          wildcards.forEach((wc) => {
            b.orWhere((wcb) => {
              wcb
                .whereLike('cmctc.fnamn', wc)
                .orWhereLike('cmctc.enamn', wc)
                .orWhereLike('cmctc.cmctcben', wc)
            })
          })
        )
      }

      if (pagination) {
        query
          .offset(pagination.page * pagination.pageSize)
          .limit(pagination.pageSize)
          .orderBy('cmctc.cmctckod')
      }

      return await query
    },
  }
}

export const contactsBaseQuery = (db: knex.Knex) => {
  const query = db
    .from('cmctc')
    .select(
      'cmctc.cmctckod as contactCode',
      'cmctc.fnamn as firstName',
      'cmctc.enamn as lastName',
      'cmctc.cmctcben as fullName',
      'cmctc.persorgnr as nationalRegistrationNumber',
      'cmctc.birthdate as birthDate',
      'cmadr.adress1 as street',
      'cmadr.adress3 as postalCode',
      'cmadr.adress4 as city',
      'cmeml.cmemlben as emailAddress',
      'cmctc.keycmobj as keycmobj',
      'cmctc.keycmctc as contactKey',
      'bkkty.bkktyben as queueName',
      'bkqte.quetime as queueTime',
      'cmctc.lagsokt as protectedIdentity',
      'cmctc.utslag as specialAttention'
    )
    .leftJoin('cmadr', 'cmadr.keycode', 'cmctc.keycmobj')
    .leftJoin('cmeml', 'cmeml.keycmobj', 'cmctc.keycmobj')
    .leftJoin('bkqte', 'bkqte.keycmctc', 'cmctc.keycmctc')
    .leftJoin('bkkty', 'bkkty.keybkkty', 'bkqte.keybkkty')
    .whereNot('cmctc.cmctckod', null)
    .where('cmadr.tdate', null) //only get active address

  return query
}
