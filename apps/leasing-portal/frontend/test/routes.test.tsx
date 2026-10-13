import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'

import { leasingRoutes } from '../src/pages/routes'
import { TestHost } from './testUtils'

const renderAt = (url: string) => {
  const router = createMemoryRouter(
    [
      {
        path: '/uthyrning',
        element: (
          <TestHost>
            <Outlet />
          </TestHost>
        ),
        children: leasingRoutes,
      },
    ],
    { initialEntries: [url] }
  )
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  // The Bostad page fetches on mount; keep it pending so routing is all we test.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('leasingRoutes', () => {
  it('redirects the module root to bostad', async () => {
    renderAt('/uthyrning')

    expect(await screen.findByRole('heading', { name: 'Bostad' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Historik' })).toBeNull()
  })

  it.each([
    ['/uthyrning/bostad', 'Bostad'],
    ['/uthyrning/bostad/poangsatt', 'Poängsatt'],
    ['/uthyrning/bilplats', 'Bilplats'],
    ['/uthyrning/forrad', 'Förråd'],
  ])('renders %s', (url, heading) => {
    renderAt(url)

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
  })

  it('addresses the poangsatt tabs by path segment', () => {
    renderAt('/uthyrning/bostad/poangsatt/visning')

    expect(
      screen.getByRole('link', { name: 'Visning' }).getAttribute('aria-current')
    ).toBe('page')
    expect(
      screen.getByRole('link', { name: 'Historik' }).getAttribute('href')
    ).toBe('/uthyrning/bostad/poangsatt/historik')
  })

  it('defaults poangsatt to publicerat-nu', () => {
    renderAt('/uthyrning/bostad/poangsatt')

    expect(
      screen
        .getByRole('link', { name: 'Publicerat nu' })
        .getAttribute('aria-current')
    ).toBe('page')
  })

  it('keeps poangfritt as its own page', () => {
    renderAt('/uthyrning/bostad/poangfritt')

    expect(screen.getByRole('heading', { name: 'Poängfritt' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Bostad' })).toBeNull()
  })
})
