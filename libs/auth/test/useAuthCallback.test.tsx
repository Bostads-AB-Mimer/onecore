import { StrictMode, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'

import { useAuthCallback } from '../src'
import { prepareLogin } from '../src/login'
import { config, jsonResponse, makeWrapper } from './testUtils'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

/** Starts a login in this tab and returns the nonce Keycloak would echo back. */
const startLogin = (returnTo: string) =>
  new URL(prepareLogin(config, returnTo)).searchParams.get('state') ?? ''

const arriveAtCallback = (params: Record<string, string>) =>
  window.history.replaceState(
    null,
    '',
    `/callback?${new URLSearchParams(params).toString()}`
  )

const renderCallback = () => {
  const { wrapper } = makeWrapper()
  return renderHook(() => useAuthCallback(), { wrapper }).result
}

describe('useAuthCallback', () => {
  it('exchanges the code with core and returns the stored path', async () => {
    const nonce = startLogin('/uthyrning/bostad')
    arriveAtCallback({ code: 'abc', state: nonce })
    fetchMock.mockResolvedValue(jsonResponse({}))

    const result = renderCallback()

    await waitFor(() =>
      expect(result.current).toEqual({
        tag: 'success',
        returnTo: '/uthyrning/bostad',
      })
    )
    expect(fetchMock).toHaveBeenCalledWith(`${config.coreUrl}/auth/callback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'abc', redirectUri: config.redirectUri }),
    })
  })

  it('refuses a state that does not match the pending login, without calling core', async () => {
    startLogin('/')
    arriveAtCallback({ code: 'abc', state: 'someone-elses-nonce' })

    const result = renderCallback()

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'state-mismatch' })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not exchange a code this tab never asked for, and says so without an error', async () => {
    arriveAtCallback({ code: 'abc', state: 'any' })

    const result = renderCallback()

    await waitFor(() => expect(result.current).toEqual({ tag: 'not-started' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a callback without state', async () => {
    startLogin('/')
    arriveAtCallback({ code: 'abc' })

    const result = renderCallback()

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'state-mismatch' })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cannot be replayed: the nonce is used up by the first attempt', async () => {
    const nonce = startLogin('/')
    arriveAtCallback({ code: 'abc', state: nonce })
    fetchMock.mockResolvedValue(jsonResponse({}))
    const first = renderCallback()
    await waitFor(() => expect(first.current.tag).toBe('success'))

    const second = renderCallback()

    await waitFor(() => expect(second.current).toEqual({ tag: 'not-started' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a missing code', async () => {
    const nonce = startLogin('/')
    arriveAtCallback({ state: nonce })

    const result = renderCallback()

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'missing-code' })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports an error Keycloak sent back instead of a code', async () => {
    const nonce = startLogin('/')
    arriveAtCallback({ state: nonce, error: 'access_denied' })

    const result = renderCallback()

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'keycloak-error' })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [
      'core rejects the code',
      () => fetchMock.mockResolvedValue(jsonResponse({}, 400)),
    ],
    [
      'core cannot be reached',
      () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch')),
    ],
  ])('reports a failed exchange when %s', async (_, arrange) => {
    const nonce = startLogin('/')
    arriveAtCallback({ code: 'abc', state: nonce })
    arrange()

    const result = renderCallback()

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'exchange-failed' })
    )
  })

  it('returns / for a stored path that leaves the origin', async () => {
    const nonce = startLogin('/')
    sessionStorage.setItem(
      'onecore-auth:pending-login',
      JSON.stringify({ nonce, returnTo: '/\\evil.example' })
    )
    arriveAtCallback({ code: 'abc', state: nonce })
    fetchMock.mockResolvedValue(jsonResponse({}))

    const result = renderCallback()

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'success', returnTo: '/' })
    )
  })

  it('runs the callback once under StrictMode', async () => {
    const nonce = startLogin('/')
    arriveAtCallback({ code: 'abc', state: nonce })
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { wrapper: Inner } = makeWrapper()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <Inner>{children}</Inner>
      </StrictMode>
    )
    // Without the guard the second effect run would read the pending login
    // again, find it used up and race the first run's result. Fetch alone can't
    // show that (the second run never gets that far), so count the reads.
    const getItem = vi.spyOn(Storage.prototype, 'getItem')

    const { result } = renderHook(() => useAuthCallback(), { wrapper })

    await waitFor(() => expect(result.current.tag).toBe('success'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getItem).toHaveBeenCalledTimes(1)
    getItem.mockRestore()
  })
})
