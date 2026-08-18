import { cachedBatch, cachedPromise } from '../utils/promise-cache'

afterEach(() => {
  jest.restoreAllMocks()
})

const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0))

describe('cachedPromise', () => {
  it('shares one in-flight fetch and serves it until the TTL passes', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000)
    const fetch = jest.fn().mockResolvedValue('value')
    const cache = cachedPromise(100, fetch)

    await expect(Promise.all([cache.get(), cache.get()])).resolves.toEqual([
      'value',
      'value',
    ])
    now.mockReturnValue(1_099)
    await cache.get()
    expect(fetch).toHaveBeenCalledTimes(1)

    now.mockReturnValue(1_100)
    await cache.get()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failure', async () => {
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok')
    const cache = cachedPromise(100, fetch)

    await expect(cache.get()).rejects.toThrow('boom')
    await expect(cache.get()).resolves.toBe('ok')
  })

  it('keeps the newer entry when a replaced fetch fails late', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000)
    let rejectFirst!: (err: Error) => void
    const fetch = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise((_, reject) => (rejectFirst = reject))
      )
      .mockResolvedValue('fresh')
    const cache = cachedPromise(100, fetch)

    cache.get().catch(() => undefined)
    now.mockReturnValue(1_200)
    await expect(cache.get()).resolves.toBe('fresh')

    rejectFirst(new Error('late'))
    await flushMicrotasks()
    await expect(cache.get()).resolves.toBe('fresh')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('clear() forces the next get to refetch', async () => {
    const fetch = jest.fn().mockResolvedValue('value')
    const cache = cachedPromise(100, fetch)

    await cache.get()
    cache.clear()
    await cache.get()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('cachedBatch', () => {
  it('returns values in key order, with the fallback for keys the batch missed', async () => {
    const fetch = jest.fn(
      async (keys: string[]) =>
        new Map(
          keys.filter((k) => k !== 'gone').map((k) => [k, k.toUpperCase()])
        )
    )
    const cache = cachedBatch(100, fetch, (key) => `fallback:${key}`)

    await expect(cache.get(['a', 'gone', 'b'])).resolves.toEqual([
      'A',
      'fallback:gone',
      'B',
    ])
    expect(fetch).toHaveBeenCalledWith(['a', 'gone', 'b'])
  })

  it('refetches the whole requested set when any key is missing or stale', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
    const fetch = jest.fn(
      async (keys: string[]) => new Map(keys.map((k) => [k, k]))
    )
    const cache = cachedBatch(100, fetch, (key) => key)

    await cache.get(['a', 'b'])
    await cache.get(['a', 'b'])
    expect(fetch).toHaveBeenCalledTimes(1)

    await cache.get(['a', 'c'])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenLastCalledWith(['a', 'c'])
  })

  it('does not cache a failed batch, and callers see the error', async () => {
    const fetch = jest
      .fn<Promise<Map<string, string>>, [string[]]>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(async (keys) => new Map(keys.map((k) => [k, 'ok'])))
    const cache = cachedBatch(100, fetch, () => 'fallback')

    await expect(cache.get(['a'])).rejects.toThrow('boom')
    await expect(cache.get(['a'])).resolves.toEqual(['ok'])
  })

  it('keeps the newer entries when a replaced batch fails late', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000)
    let rejectFirst!: (err: Error) => void
    const fetch = jest
      .fn<Promise<Map<string, string>>, [string[]]>()
      .mockImplementationOnce(
        () => new Promise((_, reject) => (rejectFirst = reject))
      )
      .mockImplementation(
        async (keys) => new Map(keys.map((k) => [k, 'fresh']))
      )
    const cache = cachedBatch(100, fetch, () => 'fallback')

    cache.get(['a']).catch(() => undefined)
    now.mockReturnValue(1_200)
    await expect(cache.get(['a'])).resolves.toEqual(['fresh'])

    rejectFirst(new Error('late'))
    await flushMicrotasks()
    await expect(cache.get(['a'])).resolves.toEqual(['fresh'])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('prime starts the fetch so a later get reuses it', async () => {
    const fetch = jest.fn(
      async (keys: string[]) => new Map(keys.map((k) => [k, 'v']))
    )
    const cache = cachedBatch(100, fetch, () => 'fallback')

    cache.prime(['a'])
    await expect(cache.get(['a'])).resolves.toEqual(['v'])
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
