export type ResourceStatus = 'uninitialized' | 'ready' | 'failed'

export interface Resource<T> {
  readonly status: ResourceStatus
  readonly name: string
  get(): T // throws if not ready
  check(): Promise<void> // verifies health
  init(): Promise<void> // (re)initialize if possible
  close(): Promise<void> // optional teardown
}

export function makeResource<T>(
  name: string,
  initializer: () => Promise<T>,
  checker: (instance: T) => Promise<boolean>,
  destroyer?: (instance: T) => Promise<void>
): Resource<T> {
  let instance: T | null = null
  let status: ResourceStatus = 'uninitialized'
  let lastError: Error | null = null

  async function init() {
    try {
      instance = await initializer()
      status = 'ready'
      lastError = null
    } catch (err) {
      status = 'failed'
      lastError = err as Error
      throw err
    }
  }

  function get(): T {
    if (status !== 'ready' || !instance) {
      throw new Error(`Resource ${name} is not ready (${status})`)
    }
    return instance
  }

  async function check() {
    if (!instance) throw new Error(`Resource ${name} not initialized`)
    const ok = await checker(instance)
    if (!ok) {
      status = 'failed'
      throw new Error(`Resource ${name} health check failed`)
    }
  }

  async function close() {
    if (instance && destroyer) {
      await destroyer(instance)
    }
    instance = null
    status = 'uninitialized'
  }

  init()

  return {
    get,
    check,
    init,
    close,
    get name() {
      return name
    },
    get status() {
      return status
    },
  }
}
