import { createLeasingApi } from '../src/api/client'
import { BffNotConfiguredError, describeBffError } from '../src/api/errors'

describe('createLeasingApi without a BFF url', () => {
  it('rejects every call with BffNotConfiguredError', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const api = createLeasingApi({ bffUrl: '', coreUrl: 'http://core.test' })

    const error = await api.GET('/auth/profile').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(BffNotConfiguredError)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(describeBffError(error)).toBe(
      'Uthyrningstjänsten är inte konfigurerad för den här miljön.'
    )
    vi.unstubAllGlobals()
  })
})
