import knex, { Knex } from 'knex'

import { cmlogRowsSince } from '../../../adapters/xpand/cmlog-rows'

const toSQL = (query: unknown) => (query as Knex.QueryBuilder).toSQL()

describe('cmlogRowsSince', () => {
  const db = knex({ client: 'mssql' })

  it('orders by logtime, then by keycmlog within the same second', () => {
    const { sql } = toSQL(cmlogRowsSince(db, null, ['Hyresobjekt %']))

    expect(sql).toMatch(/order by \[logtime\] asc, \[keycmlog\] asc/)
  })

  it('applies every like pattern', () => {
    const { bindings } = toSQL(
      cmlogRowsSince(db, null, ['Hyresobjekt %', "%'Hyresobjekttyp'%"])
    )

    expect(bindings).toEqual(['Hyresobjekt %', "%'Hyresobjekttyp'%"])
  })

  it('reads strictly after since when given', () => {
    const since = new Date('2026-10-15T08:08:28.000Z')

    const { sql, bindings } = toSQL(
      cmlogRowsSince(db, since, ['Hyreskontrakt %'])
    )

    expect(sql).toMatch(/\[logtime\] > \?/)
    expect(bindings).toContain(since)
  })
})
