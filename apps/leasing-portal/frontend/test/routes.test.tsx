import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'

import { leasingRoutes } from '../src/pages/routes'
import { stubProfileFetch, TestHost } from './testUtils'

describe('leasingRoutes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mounts under a host prefix the way property-tree does', async () => {
    stubProfileFetch()

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
      { initialEntries: ['/uthyrning'] }
    )

    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole('heading', { name: 'Uthyrning' })
    ).toBeTruthy()
  })
})
