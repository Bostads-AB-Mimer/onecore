import { makeResource, Resource, ResourceNotReady, Logger } from '@/resource'

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

describe('Resource', () => {
  let resource: Resource<any> | null = null
  // Used for all test instances, switch to 'console' if logging is
  // required during trouble-shooting
  let logger: Logger | 'off' = 'off'

  afterEach(async () => {
    if (resource !== null && resource.status !== 'closed') {
      await resource.close()
      resource = null
    }
  })

  describe('Initialization', () => {
    it('initializes successfully on manual init', async () => {
      // Given
      resource = makeResource({
        name: 'test',
        logger,
        initialize: async () => 42,
        healthcheck: { check: async () => true },
      })

      // Then
      expect(resource.status).toBe('uninitialized')

      await resource.init()

      expect(resource.status).toBe('ready')
      expect(resource.get()).toBe(42)
    })

    it('initializes eventually on autoInit=true', async () => {
      // Given
      resource = makeResource({
        name: 'test',
        logger,
        autoInit: true,
        initialize: async () => 42,
        healthcheck: {
          interval: 1000,
          check: async () => true,
        },
      })

      // Then
      expect(resource.status).toBe('initializing')

      await sleep(100)

      expect(resource.status).toBe('ready')
      expect(resource.get()).toBe(42)
    })

    it('does not initialize eventually on autoInit=false', async () => {
      // Given
      resource = makeResource({
        name: 'test',
        logger,
        autoInit: false,
        initialize: async () => 42,
        healthcheck: { check: async () => true },
      })

      // Then
      expect(resource.status).toBe('uninitialized')

      await sleep(100)

      expect(resource.status).toBe('uninitialized')
    })

    it('records failure on init error', async () => {
      // Given - a resource that fails on initialize
      const error = new Error('boom')
      resource = makeResource({
        name: 'test',
        logger,
        initialize: async () => {
          throw error
        },
        healthcheck: { check: async () => false },
      })

      // Then
      await expect(async () => await resource!.init()).rejects.toThrow()
      expect(resource.status).toBe('failed')
      expect(resource.lastError).toBe(error)
    })

    it('does not initialize twice concurrently', async () => {
      // Given
      const init = jest.fn(async () => 123)

      resource = makeResource({
        name: 'test',
        logger,
        initialize: init,
        healthcheck: { check: async () => true },
      })

      // When - three concurrent calls to init() occur
      await Promise.all([resource.init(), resource.init(), resource.init()])

      // Then - only one invocation to the actual initialize-function have occurred.
      expect(init).toHaveBeenCalledTimes(1)
    })
  })

  describe('get()', () => {
    it('throws on get() when not ready', () => {
      // Given - a non-initialized resource
      resource = makeResource({
        name: 'test',
        logger,
        initialize: async () => 42,
        healthcheck: {
          check: async () => true,
        },
      })

      // Then
      expect(() => resource!.get()).toThrow(ResourceNotReady)
    })

    it('Returns resource on get() when ready', async () => {
      // Given - an initialized resource
      resource = makeResource({
        name: 'test',
        logger,
        initialize: async () => 42,
        healthcheck: {
          check: async () => true,
        },
      })
      await resource.init()

      // When
      const instance = resource!.get()

      // Then
      expect(instance).toBe(42)
    })
  })

  describe('healthcheck', () => {
    it('fails health check, transitions to failed', async () => {
      let healthy = true

      resource = makeResource({
        name: 'test',
        logger,
        initialize: async () => ({}),
        healthcheck: { check: async () => healthy },
      })

      await resource.init()
      expect(await resource.check()).toBe(true)
      expect(resource.status).toBe('ready')

      healthy = false
      expect(await resource.check()).toBe(false)
      expect(resource.status).toBe('failed')
    })
  })

  describe('heal', () => {
    it('should automatically heal after transitioning to "failed".', async () => {
      // Given
      let healthy = true

      resource = makeResource({
        name: 'test',
        logger,
        initialize: async () => {
          if (healthy) return {}
          else throw new Error('boom! boom! boom! everybody say wayo!')
        },
        healthcheck: { check: async () => healthy },
        heal: {
          strategy: 'fixed-interval',
          initialDelay: 200,
          timeUnit: 'ms',
        },
      })

      await resource.init()
      expect(await resource.check()).toBe(true)
      expect(resource.status).toBe('ready')

      // When - the Resource goes into 'failed' status and we wait
      //        the heal attempt to occur
      healthy = false
      expect(await resource.check()).toBe(false)
      expect(resource.status).toBe('failed')
      expect(resource.healStatus).toBe('scheduled')

      healthy = true
      await sleep(300)

      // Then - The resource has returned to 'ready' status.
      expect(resource.status).toBe('ready')
      expect(resource.healStatus).toBe('not-scheduled')
    })
  })

  describe('close', () => {
    it('tears down on close', async () => {
      // Given
      const teardown = jest.fn()

      resource = makeResource({
        name: 'test',
        logger,
        initialize: async () => ({}),
        healthcheck: { check: async () => true },
        teardown,
      })
      await resource.init()

      // When
      await resource.close()

      // Then
      expect(teardown).toHaveBeenCalledTimes(1)
      expect(resource.status).toBe('closed')
    })
  })
})
