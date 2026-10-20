import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { CallbackState, UserState } from '@onecore/auth'

import { AuthCallback } from '../src/shell/AuthCallback'
import { ShellRoot } from '../src/shell/ShellRoot'

// The login logic is tested in @onecore/auth; these tests cover what the shell
// shows for each state the hooks can report.
const auth = vi.hoisted(() => ({
  callback: { tag: 'loading' } as CallbackState,
  user: { tag: 'loading' } as UserState,
}))

vi.mock('@onecore/auth', () => ({
  useAuthCallback: () => auth.callback,
  useRequireUser: () => auth.user,
  useAuth: () => ({ login: vi.fn(), logout: vi.fn() }),
}))

const renderAt = (path: string, element: JSX.Element) => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '*', element: <p>Landade på {'<sökväg>'}</p> },
    ],
    { initialEntries: [path] }
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('AuthCallback', () => {
  it('goes to the stored path after a login', () => {
    auth.callback = { tag: 'success', returnTo: '/bostad?tab=2' }

    const router = renderAt('/callback', <AuthCallback />)

    expect(router.state.location.pathname).toBe('/bostad')
    expect(router.state.location.search).toBe('?tab=2')
  })

  it('goes to the start page for a callback this tab did not start', () => {
    auth.callback = { tag: 'not-started' }

    const router = renderAt('/callback', <AuthCallback />)

    expect(router.state.location.pathname).toBe('/')
  })

  it.each([
    ['state-mismatch', 'Inloggningen kunde inte verifieras'],
    ['keycloak-error', 'Inloggningen avbröts eller misslyckades'],
    ['exchange-failed', 'Ett fel uppstod vid inloggning'],
  ] as const)('shows a message and stays put on %s', (error, message) => {
    auth.callback = { tag: 'error', error }

    const router = renderAt('/callback', <AuthCallback />)

    expect(screen.getByText(message, { exact: false })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/callback')
  })
})

describe('ShellRoot', () => {
  it('says the service is unavailable rather than asking the user to log in', () => {
    auth.user = { tag: 'error', error: 'unavailable' }

    renderAt('/bostad', <ShellRoot />)

    expect(
      screen.getByText('Tjänsten är inte tillgänglig just nu', { exact: false })
    ).toBeTruthy()
  })

  it('points to support on an unknown error', () => {
    auth.user = { tag: 'error', error: 'unknown' }

    renderAt('/bostad', <ShellRoot />)

    expect(screen.getByText('Okänt fel, kontakta support.')).toBeTruthy()
  })

  it.each([
    ['loading', { tag: 'loading' }],
    ['redirecting to login', { tag: 'error', error: 'unauthenticated' }],
  ] as const)('shows the loading view while %s', (_, state) => {
    auth.user = state

    renderAt('/bostad', <ShellRoot />)

    expect(screen.getByText('Laddar...')).toBeTruthy()
  })
})
