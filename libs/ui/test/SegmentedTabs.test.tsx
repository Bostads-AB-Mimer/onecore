import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { SegmentedTabs } from '../src'

const TABS = [
  { value: 'publicera', label: 'Publicera', count: 7 },
  { value: 'visning', label: 'Visning', count: 0 },
  {
    value: 'historik',
    label: 'Historik',
    icon: ({ className }: { className?: string }) => (
      <svg data-testid="historik-icon" className={className} />
    ),
  },
  { value: 'arkiv', label: 'Arkiv', disabled: true },
]

const renderAt = (url: string, value = 'publicera') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SegmentedTabs tabs={TABS} value={value} basePath="/uthyrning" />
    </MemoryRouter>
  )

const link = (name: RegExp) => screen.getByRole('link', { name })

describe('SegmentedTabs', () => {
  it('links every tab to its segment under basePath', () => {
    renderAt('/uthyrning')

    expect(link(/Publicera/).getAttribute('href')).toBe('/uthyrning/publicera')
    expect(link(/Historik/).getAttribute('href')).toBe('/uthyrning/historik')
  })

  it('keeps the query string but drops page', () => {
    renderAt('/uthyrning/publicera?omrade=centrum&page=3')

    expect(link(/Visning/).getAttribute('href')).toBe(
      '/uthyrning/visning?omrade=centrum'
    )
  })

  it('marks only the active tab as current', () => {
    renderAt('/uthyrning/visning', 'visning')

    expect(link(/Visning/).getAttribute('aria-current')).toBe('page')
    expect(link(/Publicera/).getAttribute('aria-current')).toBeNull()
  })

  it('renders a count pill only when count is given', () => {
    renderAt('/uthyrning')

    expect(link(/Publicera/).textContent).toBe('Publicera7')
    expect(link(/Visning/).textContent).toBe('Visning0')
    expect(link(/Historik/).textContent).toBe('Historik')
  })

  it('renders a disabled tab as plain text, not a link', () => {
    renderAt('/uthyrning')

    expect(screen.queryByRole('link', { name: /Arkiv/ })).toBeNull()
    expect(screen.getByText('Arkiv').getAttribute('aria-disabled')).toBe('true')
  })

  it('renders an optional icon before the label', () => {
    renderAt('/uthyrning')

    expect(link(/Historik/).contains(screen.getByTestId('historik-icon'))).toBe(
      true
    )
  })
})
