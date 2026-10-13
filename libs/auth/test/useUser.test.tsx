import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider, useRequireUser, useUser } from '../src'
import { config, jsonResponse, makeWrapper, profile } from './testUtils'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const renderUser = () => {
  const { wrapper, queryClient } = makeWrapper()
  const { result } = renderHook(() => useUser(), { wrapper })
  return { result, queryClient }
}

/** Runs useUser's two retries (1s + 2s backoff) without waiting for real. */
const runRetries = () => act(() => vi.advanceTimersByTimeAsync(4000))

describe('useUser', () => {
  it('reads the profile from core with credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse(profile))
    const { result } = renderUser()

    await waitFor(() => expect(result.current.tag).toBe('success'))
    expect(fetchMock).toHaveBeenCalledWith(`${config.coreUrl}/auth/profile`, {
      credentials: 'include',
    })
  })

  it('maps the Keycloak profile to a user with flat roles and employeeId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(profile))
    const { result } = renderUser()

    await waitFor(() =>
      expect(result.current).toEqual({
        tag: 'success',
        user: {
          id: 'user-1',
          name: 'Test Testsson',
          email: 'test@example.com',
          employeeId: 'YY2333',
          roles: ['leasing'],
        },
      })
    )
  })

  it('is unauthenticated on 401, without retrying', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    const { result } = renderUser()

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'unauthenticated' })
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([500, 502, 503])(
    'is unavailable, not unauthenticated, on %i',
    async (status) => {
      vi.useFakeTimers()
      fetchMock.mockResolvedValue(jsonResponse({}, status))
      const { result } = renderUser()

      await runRetries()

      expect(result.current).toEqual({ tag: 'error', error: 'unavailable' })
    }
  )

  it('is unavailable when core cannot be reached', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderUser()

    await runRetries()

    expect(result.current).toEqual({ tag: 'error', error: 'unavailable' })
  })

  it('is unavailable on 204, which core sends when it cannot reach Keycloak', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const { result } = renderUser()

    await runRetries()

    expect(result.current).toEqual({ tag: 'error', error: 'unavailable' })
  })

  it('is unknown when the profile does not match the schema', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(jsonResponse({ id: 'user-1' }))
    const { result } = renderUser()

    await runRetries()

    expect(result.current).toEqual({ tag: 'error', error: 'unknown' })
  })

  it('keeps a loaded user when a later poll fails with 5xx', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(jsonResponse(profile))
    const { result, queryClient } = renderUser()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.tag).toBe('success')

    fetchMock.mockResolvedValue(jsonResponse({}, 503))
    await act(async () => {
      void queryClient.refetchQueries()
      await vi.advanceTimersByTimeAsync(4000)
    })

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
    expect(result.current).toMatchObject({
      tag: 'success',
      user: { id: 'user-1' },
    })
  })

  it('drops a loaded user when a later poll gets 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(profile))
    const { result, queryClient } = renderUser()
    await waitFor(() => expect(result.current.tag).toBe('success'))

    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    await act(() => queryClient.refetchQueries())

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'unauthenticated' })
    )
  })
})

describe('useRequireUser', () => {
  it('starts one login, returning to the current path, when unauthenticated', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/uthyrning/bostad',
      search: '?tab=2',
      origin: 'https://app.example',
      assign,
    })
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    // A new config object on every render (as an app passing an inline object
    // would) gives useAuth a new login function, which re-runs the redirect
    // effect: only the redirecting guard keeps it to one login.
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider config={{ ...config }}>{children}</AuthProvider>
      </QueryClientProvider>
    )

    const { result, rerender } = renderHook(() => useRequireUser(), {
      wrapper,
    })
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1))
    rerender()
    rerender()

    expect(result.current).toEqual({ tag: 'error', error: 'unauthenticated' })
    expect(assign).toHaveBeenCalledTimes(1)
    const loginUrl = new URL(assign.mock.calls[0][0] as string)
    expect(loginUrl.searchParams.get('client_id')).toBe(config.clientId)
    expect(
      JSON.parse(sessionStorage.getItem('onecore-auth:pending-login') ?? '')
    ).toMatchObject({ returnTo: '/uthyrning/bostad?tab=2' })
  })

  it('reports unknown instead of loading forever when the login cannot start', async () => {
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError')
    })
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useRequireUser(), { wrapper })

    await waitFor(() =>
      expect(result.current).toEqual({ tag: 'error', error: 'unknown' })
    )
    vi.mocked(Storage.prototype.setItem).mockRestore()
  })

  it('does not start a login when core is unavailable', async () => {
    vi.useFakeTimers()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    fetchMock.mockResolvedValue(jsonResponse({}, 503))
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useRequireUser(), { wrapper })
    await runRetries()

    expect(result.current).toEqual({ tag: 'error', error: 'unavailable' })
    expect(assign).not.toHaveBeenCalled()
  })
})
