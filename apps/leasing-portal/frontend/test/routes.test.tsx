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

describe('leasingRoutes', () => {
  it('redirects the module root to bostad', async () => {
    renderAt('/uthyrning')

    expect(await screen.findByRole('heading', { name: 'Bostad' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Historik' }).getAttribute('href')
    ).toBe('/uthyrning/bostad/historik')
  })

  it.each([
    ['/uthyrning/bostad', 'Bostad'],
    ['/uthyrning/bilplats', 'Bilplats'],
    ['/uthyrning/forrad', 'Förråd'],
  ])('renders %s', (url, heading) => {
    renderAt(url)

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
  })

  it('addresses the bostad tabs by path segment', () => {
    renderAt('/uthyrning/bostad/visning')

    expect(
      screen.getByRole('link', { name: 'Visning' }).getAttribute('aria-current')
    ).toBe('page')
    expect(
      screen.getByRole('link', { name: 'Historik' }).getAttribute('href')
    ).toBe('/uthyrning/bostad/historik')
  })

  it('lets poangfritt win over the bostad tab segment', () => {
    renderAt('/uthyrning/bostad/poangfritt')

    expect(screen.getByRole('heading', { name: 'Poängfritt' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Bostad' })).toBeNull()
  })
})
