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
