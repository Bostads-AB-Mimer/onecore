import { Prisma } from '@prisma/client'
import {
  componentCountSql,
  componentPageSql,
} from '../../adapters/component-list-query'

const text = (sql: Prisma.Sql) => sql.sql.replace(/\s+/g, ' ').trim()

const orderBy = (sql: Prisma.Sql) => {
  const query = text(sql)
  return query.slice(query.indexOf('ORDER BY'), query.indexOf(' OFFSET'))
}

describe('componentPageSql', () => {
  it('joins the active installation and the model once per component', () => {
    const query = text(componentPageSql({}, undefined, 0, 25))

    expect(query).toContain('FROM dbo.components c')
    expect(query).toContain(
      'LEFT JOIN dbo.component_installations i ON i.componentId = c.id AND i.deinstallationDate IS NULL'
    )
    expect(query).toContain(
      'LEFT JOIN dbo.component_models m ON m.id = c.modelId'
    )
  })

  it('pages with OFFSET and FETCH', () => {
    const sql = componentPageSql({}, undefined, 50, 25)

    expect(text(sql)).toMatch(/OFFSET \? ROWS FETCH NEXT \? ROWS ONLY$/)
    expect(sql.values.slice(-2)).toEqual([50, 25])
  })

  it('sorts by installation date, newest first and unknown dates last, by default', () => {
    expect(orderBy(componentPageSql({}, undefined, 0, 25))).toBe(
      "ORDER BY CASE WHEN i.installationDate >= '1901-01-01' THEN 0 ELSE 1 END, CASE WHEN i.installationDate >= '1901-01-01' THEN i.installationDate END DESC, c.id ASC"
    )
  })

  it('keeps unknown installation dates last, unordered among themselves, when sorting oldest first', () => {
    expect(
      orderBy(
        componentPageSql({}, { sortBy: 'installed', sortOrder: 'asc' }, 0, 25)
      )
    ).toBe(
      "ORDER BY CASE WHEN i.installationDate >= '1901-01-01' THEN 0 ELSE 1 END, CASE WHEN i.installationDate >= '1901-01-01' THEN i.installationDate END ASC, c.id ASC"
    )
  })

  it('sorts text in Swedish order with blanks last', () => {
    expect(
      orderBy(
        componentPageSql({}, { sortBy: 'model', sortOrder: 'desc' }, 0, 25)
      )
    ).toBe(
      "ORDER BY CASE WHEN NULLIF(LTRIM(CONCAT(CASE WHEN m.manufacturer COLLATE Latin1_General_CS_AS <> 'Unknown' THEN NULLIF(LTRIM(RTRIM(m.manufacturer)), '') + ' ' END, LTRIM(RTRIM(m.modelName)))), '') IS NULL THEN 1 ELSE 0 END, NULLIF(LTRIM(CONCAT(CASE WHEN m.manufacturer COLLATE Latin1_General_CS_AS <> 'Unknown' THEN NULLIF(LTRIM(RTRIM(m.manufacturer)), '') + ' ' END, LTRIM(RTRIM(m.modelName)))), '') COLLATE Finnish_Swedish_CI_AS DESC, c.id ASC"
    )
    expect(
      orderBy(
        componentPageSql(
          {},
          { sortBy: 'serialNumber', sortOrder: 'asc' },
          0,
          25
        )
      )
    ).toContain(
      "NULLIF(LTRIM(c.serialNumber), '') COLLATE Finnish_Swedish_CI_AS ASC"
    )
    expect(
      orderBy(
        componentPageSql(
          {},
          { sortBy: 'specifications', sortOrder: 'asc' },
          0,
          25
        )
      )
    ).toContain(
      "CASE WHEN NULLIF(LTRIM(c.specifications), '') IS NULL THEN 1 ELSE 0 END"
    )
  })

  it('sorts quantity with zero last', () => {
    expect(
      orderBy(
        componentPageSql({}, { sortBy: 'quantity', sortOrder: 'asc' }, 0, 25)
      )
    ).toBe(
      'ORDER BY CASE WHEN c.quantity > 0 THEN 0 ELSE 1 END, c.quantity ASC, c.id ASC'
    )
  })

  it('defaults to ascending when only the column is given', () => {
    expect(orderBy(componentPageSql({}, { sortBy: 'model' }, 0, 25))).toContain(
      "NULLIF(LTRIM(CONCAT(CASE WHEN m.manufacturer COLLATE Latin1_General_CS_AS <> 'Unknown' THEN NULLIF(LTRIM(RTRIM(m.manufacturer)), '') + ' ' END, LTRIM(RTRIM(m.modelName)))), '') COLLATE Finnish_Swedish_CI_AS ASC"
    )
  })

  it('sorts models by the trimmed label the table shows, without the Unknown manufacturer', () => {
    expect(orderBy(componentPageSql({}, { sortBy: 'model' }, 0, 25))).toContain(
      "CASE WHEN m.manufacturer COLLATE Latin1_General_CS_AS <> 'Unknown' THEN NULLIF(LTRIM(RTRIM(m.manufacturer)), '') + ' ' END, LTRIM(RTRIM(m.modelName))"
    )
  })
})

describe('component list filters', () => {
  const where = (filters: Parameters<typeof componentCountSql>[0]) => {
    const sql = componentCountSql(filters)
    const query = text(sql)
    return { query: query.slice(query.indexOf('WHERE')), values: sql.values }
  }

  it('matches every row without filters', () => {
    expect(where({}).query).toBe('WHERE 1 = 1')
  })

  it('filters by subtype, model and status', () => {
    const { query, values } = where({
      subtypeId: 'S1',
      modelId: 'M1',
      status: 'ACTIVE',
    })

    expect(query).toBe(
      'WHERE c.subtypeId = ? AND c.modelId = ? AND c.status = ?'
    )
    expect(values).toEqual(['S1', 'M1', 'ACTIVE'])
  })

  it('finds components without a model', () => {
    expect(where({ withoutModel: true }).query).toBe('WHERE c.modelId IS NULL')
  })

  it('searches serial numbers and specifications from two characters, escaping LIKE wildcards', () => {
    expect(where({ serialNumber: ' 4' }).query).toBe('WHERE 1 = 1')

    const { query, values } = where({
      serialNumber: ' 47_1 ',
      specifications: '100%',
    })
    expect(query).toBe(
      'WHERE c.serialNumber LIKE ? AND c.specifications LIKE ?'
    )
    expect(values).toEqual(['%47[_]1%', '%100[%]%'])
  })

  it('filters on the active installation', () => {
    expect(where({ installation: 'installed' }).query).toBe(
      'WHERE i.id IS NOT NULL'
    )
    expect(where({ installation: 'notInstalled' }).query).toBe(
      'WHERE i.id IS NULL'
    )
    expect(where({ notInstalled: true }).query).toBe('WHERE i.id IS NULL')
    expect(where({ installation: 'unknownDate' }).query).toBe(
      "WHERE i.id IS NOT NULL AND (i.installationDate IS NULL OR i.installationDate < '1901-01-01')"
    )
  })

  it('counts only known installation dates before the given year', () => {
    const { query, values } = where({ installedBefore: 2010 })

    expect(query).toBe(
      "WHERE i.installationDate >= '1901-01-01' AND i.installationDate < ?"
    )
    expect(values).toEqual(['2010-01-01'])
  })

  it('counts with the same joins as the page', () => {
    expect(text(componentCountSql({}))).toMatch(
      /^SELECT COUNT\(\*\) AS total FROM dbo\.components c LEFT JOIN dbo\.component_installations i/
    )
  })
})
