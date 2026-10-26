import knex, { Knex } from 'knex'
import { cmlogContactChanges } from '@src/adapters/xpand/query'

const toSQL = (query: unknown) => (query as Knex.QueryBuilder).toSQL()

describe('cmlogContactChanges', () => {
  const db = knex({ client: 'mssql' })

  it('reads from since inclusive, so the rest of a half-read second is seen', () => {
    const since = new Date('2026-10-15T08:08:28.000Z')

    const { sql, bindings } = toSQL(cmlogContactChanges(db, since))

    expect(sql).toMatch(/\[logtime\] >= \?/)
    expect(bindings).toContain(since)
  })

  it('reads every contact row, oldest first, when since is null', () => {
    const { sql, bindings } = toSQL(cmlogContactChanges(db, null))

    expect(sql).not.toMatch(/logtime\] >/)
    expect(sql).toMatch(/order by \[logtime\] asc/)
    expect(bindings).toEqual(['Kontakt %'])
  })
})
