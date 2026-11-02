// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Column, DataTable, type DataTableProps } from './DataTable'
import type { TableSort } from './dataTableSort'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string; count: number | null }

const rows: Row[] = [
  { id: 'b', name: 'Bänk', count: 3 },
  { id: 'a', name: 'Altan', count: null },
  { id: 'c', name: 'Cykel', count: 10 },
]

const columns: Column<Row>[] = [
  {
    key: 'name',
    label: 'Namn',
    render: (r) => r.name,
    sort: { value: (r) => r.name, kind: 'text' },
  },
  {
    key: 'count',
    label: 'Komponenter',
    render: (r) => String(r.count ?? '-'),
    sort: { value: (r) => r.count, kind: 'number', firstOrder: 'desc' },
  },
  { key: 'note', label: 'Anteckning', render: () => '' },
]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const renderTable = (props: Partial<DataTableProps<Row>>) =>
  act(() =>
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(DataTable<Row>, {
          data: rows,
          columns,
          isLoading: false,
          onEdit: () => undefined,
          onDelete: () => undefined,
          ...props,
        })
      )
    )
  )

const header = (label: string) =>
  [...container.querySelectorAll('th')].find((th) =>
    th.textContent?.includes(label)
  )!

const shownNames = () =>
  [...container.querySelectorAll('tbody tr')].map(
    (tr) => tr.querySelector('td')?.textContent
  )

describe('DataTable sorting', () => {
  it('sorts the rows by the active column, blanks last', () => {
    renderTable({
      sort: { key: 'count', order: 'desc' },
      onSortChange: vi.fn(),
    })

    expect(shownNames()).toEqual(['Cykel', 'Bänk', 'Altan'])
  })

  it('marks the sort state on the headers for screen readers', () => {
    renderTable({
      sort: { key: 'count', order: 'desc' },
      onSortChange: vi.fn(),
    })

    expect(header('Komponenter').getAttribute('aria-sort')).toBe('descending')
    expect(header('Namn').getAttribute('aria-sort')).toBe('none')
    expect(header('Anteckning').hasAttribute('aria-sort')).toBe(false)
    expect(header('Anteckning').querySelector('button')).toBeNull()
  })

  it('asks to flip the active column and to start another in its natural direction', () => {
    const onSortChange = vi.fn<(sort: TableSort) => void>()
    renderTable({ sort: { key: 'name', order: 'asc' }, onSortChange })

    act(() => header('Namn').querySelector('button')!.click())
    act(() => header('Komponenter').querySelector('button')!.click())

    expect(onSortChange.mock.calls).toEqual([
      [{ key: 'name', order: 'desc' }],
      [{ key: 'count', order: 'desc' }],
    ])
  })

  it('keeps the given order when the server already sorted the rows', () => {
    renderTable({
      sort: { key: 'name', order: 'desc' },
      onSortChange: vi.fn(),
      serverSorted: true,
    })

    expect(shownNames()).toEqual(['Bänk', 'Altan', 'Cykel'])
  })

  it('keeps the given order for the default sort', () => {
    renderTable({
      sort: { key: 'name', order: 'asc' },
      defaultSort: { key: 'name', order: 'asc' },
      onSortChange: vi.fn(),
    })

    expect(shownNames()).toEqual(['Bänk', 'Altan', 'Cykel'])
  })

  it('offers every sortable column in both directions for phones', () => {
    renderTable({ sort: { key: 'name', order: 'asc' }, onSortChange: vi.fn() })

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Sortera"]'
    )!
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Namn, A–Ö',
      'Namn, Ö–A',
      'Komponenter, högst först',
      'Komponenter, lägst först',
    ])
    expect(select.value).toBe('name:asc')
  })

  it('shows a placeholder on phones when the active sort has no option', () => {
    renderTable({ sort: { key: 'note', order: 'asc' }, onSortChange: vi.fn() })

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Sortera"]'
    )!
    expect(select.options[0].textContent).toBe('Sortera')
    expect(select.options[0].disabled).toBe(true)
    expect(select.value).toBe('')
  })

  it('renders plain headers without onSortChange', () => {
    renderTable({})

    expect(header('Namn').querySelector('button')).toBeNull()
    expect(container.querySelector('select[aria-label="Sortera"]')).toBeNull()
    expect(shownNames()).toEqual(['Bänk', 'Altan', 'Cykel'])
  })
})
