import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Pagination } from '../src'

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalRecords={5}
        pageSize={20}
        onPageChange={() => {}}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows the record window and navigates', async () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={2}
        totalPages={3}
        totalRecords={45}
        pageSize={20}
        onPageChange={onPageChange}
      />
    )

    expect(screen.getByText('Visar 21-40 av 45')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: '2' }).getAttribute('aria-current')
    ).toBe('page')

    await userEvent.click(screen.getByTitle('Nästa sida'))
    expect(onPageChange).toHaveBeenLastCalledWith(3)
    await userEvent.click(screen.getByTitle('Första sidan'))
    expect(onPageChange).toHaveBeenLastCalledWith(1)
  })

  it('collapses long ranges with ellipses around the current page', () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        totalRecords={400}
        pageSize={20}
        onPageChange={() => {}}
      />
    )
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => t && /^\d+$/.test(t))
    expect(labels).toEqual(['1', '9', '10', '11', '20'])
    expect(screen.getAllByText('...')).toHaveLength(2)
  })
})

describe('Pagination page size selector', () => {
  it('renders nothing on a single page without a page size selector', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalRecords={40}
        pageSize={100}
        onPageChange={() => {}}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows the selector on a single page, without page buttons', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalRecords={40}
        pageSize={100}
        onPageChange={() => {}}
        pageSizeOptions={[50, 100]}
        onPageSizeChange={() => {}}
      />
    )
    expect(screen.getByText('Rader per sida')).toBeTruthy()
    expect(screen.getByRole('combobox').textContent).toBe('100')
    expect(screen.queryByTitle('Nästa sida')).toBeNull()
  })

  it('shows the selector next to the page buttons on several pages', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        totalRecords={250}
        pageSize={100}
        onPageChange={() => {}}
        pageSizeOptions={[50, 100]}
        onPageSizeChange={() => {}}
      />
    )
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByTitle('Nästa sida')).toBeTruthy()
  })

  it('renders nothing without results', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalRecords={0}
        pageSize={100}
        onPageChange={() => {}}
        pageSizeOptions={[50, 100]}
        onPageSizeChange={() => {}}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('leaves out the selector without a change handler', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        totalRecords={250}
        pageSize={100}
        onPageChange={() => {}}
        pageSizeOptions={[50, 100]}
      />
    )
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByTitle('Nästa sida')).toBeTruthy()
  })
})
