import { describe, expect, it } from 'vitest'

import { toHomeInsuranceQuery } from './homeInsuranceFilters'

const query = (url: string, search = '') =>
  toHomeInsuranceQuery(new URLSearchParams(url), search)

describe('toHomeInsuranceQuery', () => {
  it('lists the LF rows by default', () => {
    expect(query('')).toEqual({
      q: undefined,
      status: undefined,
      rows: 'lf',
      sameDate: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    })
  })

  it('maps the views to rows and sameDate', () => {
    expect(query('view=all')).toMatchObject({
      rows: 'all',
      sameDate: undefined,
    })
    expect(query('view=same-date')).toMatchObject({
      rows: 'all',
      sameDate: true,
    })
    expect(query('view=bogus')).toMatchObject({ rows: 'lf' })
  })

  it('keeps only known statuses', () => {
    expect(query('status=G&status=*&status=X').status).toEqual(['G', '*'])
    expect(query('status=X').status).toBeUndefined()
  })

  it('drops an unknown sort key and order', () => {
    expect(query('sortBy=fullName&sortOrder=up')).toMatchObject({
      sortBy: undefined,
      sortOrder: undefined,
    })
    expect(query('sortBy=rowToDate&sortOrder=desc')).toMatchObject({
      sortBy: 'rowToDate',
      sortOrder: 'desc',
    })
  })

  it('searches from 3 characters, trimmed', () => {
    expect(query('', ' 12 ').q).toBeUndefined()
    expect(query('', ' 123 ').q).toBe('123')
  })
})
