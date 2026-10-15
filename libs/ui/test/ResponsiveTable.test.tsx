import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ResponsiveTable, useRowSelection } from '../src'
import type { ResponsiveTableColumn } from '../src'
import { setMobile } from './setup'

type Row = { id: string; name: string; city: string }

const rows: Row[] = [
  { id: '1', name: 'Anna', city: 'Västerås' },
  { id: '2', name: 'Bo', city: 'Enköping' },
]

const columns: ResponsiveTableColumn<Row>[] = [
  { key: 'name', label: 'Namn', render: (r) => r.name, sortKey: 'name' },
  { key: 'city', label: 'Ort', render: (r) => r.city, hideOnMobile: true },
]

const getId = (r: Row) => r.id

/** The page owns the selection; the table only renders it. */
function Selectable({ onRowClick }: { onRowClick?: (row: Row) => void }) {
  const selection = useRowSelection(rows, getId)
  return (
    <ResponsiveTable
      data={rows}
      columns={columns}
      keyExtractor={getId}
      selection={selection}
      onRowClick={onRowClick}
    />
  )
}

const checkbox = (name: string) => screen.getByRole('checkbox', { name })

afterEach(() => setMobile(false))

describe('ResponsiveTable', () => {
  it('renders a row per item and the empty message otherwise', () => {
    const { rerender } = render(
      <ResponsiveTable data={rows} columns={columns} keyExtractor={getId} />
    )
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('Enköping')).toBeTruthy()

    rerender(
      <ResponsiveTable
        data={[]}
        columns={columns}
        keyExtractor={getId}
        emptyMessage="Tomt"
      />
    )
    expect(screen.getByText('Tomt')).toBeTruthy()
  })

  it('cycles sort asc, desc, off on header clicks', async () => {
    const onSort = vi.fn()
    const at = (sortOrder?: 'asc' | 'desc') => (
      <ResponsiveTable
        data={rows}
        columns={columns}
        keyExtractor={getId}
        onSort={onSort}
        sortBy={sortOrder && 'name'}
        sortOrder={sortOrder}
      />
    )
    const header = () => screen.getByRole('columnheader', { name: /Namn/ })
    const { rerender } = render(at())

    await userEvent.click(header())
    expect(onSort).toHaveBeenLastCalledWith('name', 'asc')

    rerender(at('asc'))
    expect(header().getAttribute('aria-sort')).toBe('ascending')
    await userEvent.click(header())
    expect(onSort).toHaveBeenLastCalledWith('name', 'desc')

    rerender(at('desc'))
    await userEvent.click(header())
    expect(onSort).toHaveBeenLastCalledWith('name', undefined)
  })

  it('renders a checkbox column bound to the selection', async () => {
    render(<Selectable />)

    expect(checkbox('Välj alla').getAttribute('aria-checked')).toBe('false')

    await userEvent.click(checkbox('Välj 1'))
    expect(checkbox('Välj 1').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('Välj alla').getAttribute('aria-checked')).toBe('mixed')
    expect(checkbox('Välj 1').closest('tr')?.getAttribute('data-state')).toBe(
      'selected'
    )

    await userEvent.click(checkbox('Välj alla'))
    expect(checkbox('Välj alla').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('Välj 2').getAttribute('aria-checked')).toBe('true')
  })

  it('shift-click selects the range without toggling twice', async () => {
    render(<Selectable />)
    const user = userEvent.setup()

    await user.click(checkbox('Välj 1'))
    await user.keyboard('{Shift>}')
    await user.click(checkbox('Välj 2'))
    await user.keyboard('{/Shift}')

    expect(checkbox('Välj 1').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('Välj 2').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('Välj alla').getAttribute('aria-checked')).toBe('true')
  })

  it('does not fire onRowClick when the checkbox is clicked', async () => {
    const onRowClick = vi.fn()
    render(<Selectable onRowClick={onRowClick} />)

    await userEvent.click(checkbox('Välj 1'))
    expect(onRowClick).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('Anna'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('falls back to cards without hidden columns on mobile', () => {
    setMobile(true)
    render(
      <ResponsiveTable data={rows} columns={columns} keyExtractor={getId} />
    )
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Anna')).toBeTruthy()
    expect(screen.queryByText('Västerås')).toBeNull()
  })
})
