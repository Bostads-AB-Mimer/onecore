import { describe, expect, it } from 'vitest'

import {
  ariaSort,
  nextSort,
  type SortableColumn,
  sortOptionLabel,
  sortRows,
} from './dataTableSort'

type Row = { id: string; name: string | null; count: number | null }

const row = (id: string, name: string | null, count: number | null): Row => ({
  id,
  name,
  count,
})

const nameColumn: SortableColumn<Row> = {
  key: 'name',
  label: 'Namn',
  sort: { value: (r) => r.name, kind: 'text' },
}
const countColumn: SortableColumn<Row> = {
  key: 'count',
  label: 'Komponenter',
  sort: { value: (r) => r.count, kind: 'number', firstOrder: 'desc' },
}

const ids = (rows: Row[]) => rows.map((r) => r.id)

describe('sortRows', () => {
  it('sorts text in Swedish order, numbers inside text by value', () => {
    const rows = [
      row('ä', 'Ärter', 1),
      row('å', 'Ål', 1),
      row('o', 'Ö', 1),
      row('10', 'Spis 10', 1),
      row('9', 'Spis 9', 1),
    ]
    expect(ids(sortRows(rows, nameColumn.sort!.value!, 'asc'))).toEqual([
      '9',
      '10',
      'å',
      'ä',
      'o',
    ])
  })

  it('puts blank values last in both directions', () => {
    const rows = [
      row('blank', '  ', 0),
      row('b', 'B', null),
      row('none', null, 3),
      row('a', 'A', 2),
    ]
    expect(ids(sortRows(rows, nameColumn.sort!.value!, 'asc'))).toEqual([
      'a',
      'b',
      'blank',
      'none',
    ])
    expect(ids(sortRows(rows, nameColumn.sort!.value!, 'desc'))).toEqual([
      'b',
      'a',
      'blank',
      'none',
    ])
    expect(ids(sortRows(rows, countColumn.sort!.value!, 'desc'))).toEqual([
      'none',
      'a',
      'blank',
      'b',
    ])
  })

  it('keeps the incoming order for equal values', () => {
    const rows = [row('1', 'X', 1), row('2', 'X', 1), row('3', 'X', 1)]
    expect(ids(sortRows(rows, nameColumn.sort!.value!, 'desc'))).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('leaves the input untouched', () => {
    const rows = [row('b', 'B', 1), row('a', 'A', 1)]
    sortRows(rows, nameColumn.sort!.value!, 'asc')
    expect(ids(rows)).toEqual(['b', 'a'])
  })
})

describe('nextSort', () => {
  it('flips the direction of the active column', () => {
    expect(nextSort({ key: 'name', order: 'asc' }, nameColumn)).toEqual({
      key: 'name',
      order: 'desc',
    })
    expect(nextSort({ key: 'name', order: 'desc' }, nameColumn)).toEqual({
      key: 'name',
      order: 'asc',
    })
  })

  it('starts a new column in its natural direction', () => {
    expect(nextSort({ key: 'name', order: 'asc' }, countColumn)).toEqual({
      key: 'count',
      order: 'desc',
    })
    expect(nextSort(undefined, nameColumn)).toEqual({
      key: 'name',
      order: 'asc',
    })
  })
})

describe('ariaSort', () => {
  it('describes the active column and marks other sortable ones', () => {
    const sort = { key: 'count', order: 'desc' as const }
    expect(ariaSort(countColumn, sort)).toBe('descending')
    expect(ariaSort(nameColumn, sort)).toBe('none')
    expect(ariaSort({ key: 'place', label: 'Plats' }, sort)).toBeUndefined()
  })
})

describe('sortOptionLabel', () => {
  it('names the direction in words that fit the values', () => {
    expect(sortOptionLabel(nameColumn, 'asc')).toBe('Namn, A–Ö')
    expect(sortOptionLabel(nameColumn, 'desc')).toBe('Namn, Ö–A')
    expect(sortOptionLabel(countColumn, 'desc')).toBe(
      'Komponenter, högst först'
    )
    expect(
      sortOptionLabel(
        { key: 'installed', label: 'Installerad', sort: { kind: 'date' } },
        'desc'
      )
    ).toBe('Installerad, nyast först')
  })
})
