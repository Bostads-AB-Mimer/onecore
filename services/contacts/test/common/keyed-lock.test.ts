import { createKeyedLock } from '@src/common/keyed-lock'

/** A promise the test settles by hand. */
const deferred = <T = void>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets every queued promise callback run. */
const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('createKeyedLock', () => {
  it('runs calls with the same key one at a time, in order', async () => {
    const withLock = createKeyedLock()
    const events: string[] = []
    const first = deferred()

    const a = withLock('k', async () => {
      events.push('a:start')
      await first.promise
      events.push('a:end')
      return 'a'
    })
    const b = withLock('k', async () => {
      events.push('b:start')
      return 'b'
    })

    await flush()
    expect(events).toEqual(['a:start'])

    first.resolve()
    await expect(Promise.all([a, b])).resolves.toEqual(['a', 'b'])
    expect(events).toEqual(['a:start', 'a:end', 'b:start'])
  })

  it('does not make different keys wait for each other', async () => {
    const withLock = createKeyedLock()
    const blocked = deferred()
    const events: string[] = []

    const a = withLock('k1', async () => {
      await blocked.promise
      events.push('k1')
    })
    await withLock('k2', async () => {
      events.push('k2')
    })

    expect(events).toEqual(['k2'])
    blocked.resolve()
    await a
  })

  it('releases the key when a call rejects', async () => {
    const withLock = createKeyedLock()

    await expect(
      withLock('k', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    await expect(withLock('k', async () => 'next')).resolves.toBe('next')
  })

  it('lets a waiting call run after the one before it rejects', async () => {
    const withLock = createKeyedLock()
    const first = deferred()

    const a = withLock('k', () => first.promise)
    const b = withLock('k', async () => 'b')

    first.reject(new Error('boom'))
    await expect(a).rejects.toThrow('boom')
    await expect(b).resolves.toBe('b')
  })
})
