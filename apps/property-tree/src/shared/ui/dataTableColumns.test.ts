import { describe, expect, it } from 'vitest'

import { visibleActions, visibleColumns } from './dataTableColumns'

type Row = { id: string; price: number | null; name: string }

const rows: Row[] = [
  { id: '1', price: null, name: 'A' },
  { id: '2', price: null, name: 'B' },
]

const column = (key: string, isEmpty?: (row: Row) => boolean) => ({
  key,
  label: key,
  render: () => null,
  isEmpty,
})

describe('visibleColumns', () => {
  it('hides a column that is empty on every row', () => {
    const columns = [
      column('name'),
      column('price', (row) => row.price === null),
    ]
    expect(visibleColumns(columns, rows).map((c) => c.key)).toEqual(['name'])
  })

  it('keeps a column when one row has a value', () => {
    const columns = [column('price', (row) => row.price === null)]
    expect(
      visibleColumns(columns, [...rows, { id: '3', price: 10, name: 'C' }])
    ).toHaveLength(1)
  })

  it('keeps every column while there are no rows', () => {
    const columns = [column('price', () => true)]
    expect(visibleColumns(columns, [])).toHaveLength(1)
  })
})

describe('visibleActions', () => {
  it('leaves out actions hidden for the row', () => {
    const actions = [
      { label: 'Visa', onClick: () => {} },
      { label: 'Avinstallera', onClick: () => {}, isHidden: () => true },
    ]
    expect(visibleActions(actions, rows[0]).map((a) => a.label)).toEqual([
      'Visa',
    ])
  })
})
