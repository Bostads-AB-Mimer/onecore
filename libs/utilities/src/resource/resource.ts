import { msInterval, type Unit } from './interval'
import { makeHealStrategy, type HealOptions } from './heal-strategy'
import { ResourceError, ResourceNotReady } from './error'

/**
 * The status of a Resource.
 *
 * - `uninitialized`: The resource has not been initialized yet.
 * - `initializing`: The resource is in the process of initializing.
 * - `ready`: The resource is initialized and ready for use.
 * - `failed`: The resource has failed its health check and is not usable,
 *             or was unable to initialize in the first place.
 * - `closed`: The resource has been closed and is no longer usable.
 */
export type ResourceStatus =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'failed'
  | 'closed'

/**
 * A managed resource with lifecycle and health management.
 *
 * @param T The type of the underlying resource instance.
 */
export interface Resource<T> {
  /**
   * The current status of the Resource.
   *
   * @see ResourceStatus
   */
  readonly status: ResourceStatus
  /**
   * The current status of heal attempts.
   *
   * Returns 'not-scheduled' for any Resource in 'ready'-state.
   */
  readonly healStatus: HealStatus
  /**
   * The human-readable and publishable name of the Resource.
   */
  readonly name: string
  /**
   * The last error observed while the resource is in a non-ready
   * state. Blanked out whenever the Resource reaches status 'ready'.
   */
  readonly lastError: Error | undefined
  /**
   * The time and date at which the Resource entered its current status
   * or when the current status was last re-affirmed.
   */
  readonly stateTimestamp: Date
  /**
   * Get the Resource instance.
   *
   * Every usage of the resource in the normal application flow should call
   * this function to access the resource instance, and the application should
   * never store any references to the returned resource.
   *
   * @returns The underlying resource instance.
   *
   * @throws If the Resource is not in `ready` status.
   */
  get(): T

  /**
   * Manually performs a health check on the Resource, outside of the healthcheck
   * schedule. Does not trigger an additional healthcheck if one is already in
   * progress.
   */
  check(): Promise<boolean>

  /**
   * Manually initializes or re-initializes the Resource.
   *
   * If the Resource is already in `ready` status, this is a no-op.
   * If an initialization attempt is already in progress, this does not trigger
   * a new attempt but returns the Promise representing the ongoing attempt.
   *
   * @returns A Promise that resolves when the initialization attempt is complete,
   *          regardless of success/failure.
   */
  init(): Promise<void> // (re)initialize if possible

  /**
   * Tears down the Resource, releasing any held resources.
   *
   * Typically never called by the application itself, unless it implements
   * a "controlled shutdown" mechanism (which no ONECore application does at the time
   * of writing).
   *
   * @returns A Promise that resolves when teardown attempt is complete.
   */
  close(): Promise<void> // optional teardown
}

/**
 * Options for creating a Resource.
 */
export type ResourceOptions<T> = {
  /**
   * The name of the resource.
   *
   * This name is used for logging and identification purposes, as well
   * as in health check reporting when used in combination with the
   * health probe infrastructure.
   */
  name: string

  /**
   * Logger instance to use for logging state transitions and diagnostics.
   *
   * Defaults to `console`.
   */
  logger?: Logger | 'off'

  /**
   * Whether to automatically initialize the resource upon creation.
   *
   * Defaults to `false`, in which case `init` must manually be called
   * at some point after constructing a Resource.
   *
   * If set to `true`, the resource will attempt to initialize immediately
   * upon creation. Any errors during initialization will be captured
   * and reflected in the resource's status.
   *
   * Note that if `autoInit` is enabled, the resource's `init` method
   * may still be called manually to attempt re-initialization.
   *
   * Automatic initialization is performed asynchronously. If synchronous
   * construction and initialization is required, defer to manually calling
   * `init`. This can be done idempotently, as the Resource type ensures
   * that only one initialization attempt will ever run concurrently and
   * subsequent calls to `init` while the Resource is initializing, or
   * have completed initalization will return the same Promise instance.
   */
  autoInit?: boolean

  /**
   * The resource instance-specific initialization routine.
   *
   * This is called internally by Resource during the initialization process
   * and/or healing mechanism.
   *
   * This should return the resource instance upon success, and should typically
   * not consider error/exception handling as this is handled by the internal
   * caller within Resource and is part of how Resource determines if initialization
   * was successful or not.
   */
  initialize: () => Promise<T>

  /**
   * The resource instance-specifc teardown routine.
   *
   * This is called internally by Resource when the resource has entered a failed
   * state and it is determined that the previous may be discarded in favor of
   * creating a new instance using the function provided in `initialize`.
   *
   * This is for resources with complex opaque states, where we rather evict the
   * entire previous instance rather than trusting that, for example, a connection
   * pool has been able or will be able to successfully restore all of its connections
   * after a network outage.
   */
  teardown?: (instance: T) => Promise<void>

  /**
   * Configuration for performing continous heatlh checks on the resource.
   */
  healthcheck: {
    /**
     * The fixed interval at which health checks are to be performed.
     */
    interval?: number
    /**
     * The time unit of `interval`.
     */
    intervalUnit?: Unit
    /**
     * The resource-specific method by which the health status of the
     * resource is determined.
     *
     * For a database connection resource, this could be any simple query
     * against the database that both determines that the connection is alive
     * or that the remote database server contains the expected schema, depending
     * on what granularity is required.
     */
    check: (instance: T) => Promise<boolean>
  }

  /**
   * Configuration for the healing strategy to be employed when the resource
   * enters a failed state.
   *
   * If omitted, this defaults to an exponential-backoff healing strategy
   * with an initial delay of 1 seconds and a maximum interval of 1 minute.
   */
  heal?: HealOptions
}

export type HealStatus = 'scheduled' | 'not-scheduled' | 'in-progress'

export interface Logger {
  info: Function
  error: Function
}

const NoOpLogger: Logger = {
  info: () => {},
  error: () => {},
}

/**
 * Creates a managed Resource with lifecycle and health management.
 *
 * This is a generic wrapper around any kind of local construct that manages
 * communication with external resources, such as a database connection or
 * HTTP API client.
 *
 * Treating these as Resources allows for uniform lifecycle management, health
 * checking, and automated healing/reinitialization in case of failures.
 *
 * It also allows deferring resource initialization at startup, which introduces
 * a slice of fault-tolerance where an application may accept that an
 * integration point is unavailable and not simply crash and burn at startup
 * as result.
 *
 * See `ResourceOptions` for detailed descriptions of available options.
 *
 * @param opts The options for creating the Resource.
 *
 * @returns The constructed Resource instance.
 */
export function makeResource<T>({
  name,
  autoInit = false,
  logger,
  initialize,
  healthcheck: {
    interval: hcInterval = 1,
    intervalUnit: hcUnit = 'm',
    check: hcCheckFunction,
  },
  heal,
  teardown,
}: ResourceOptions<T>): Resource<T> {
  /**
   * The current instance of the resource, if initialized.
   */
  let instance: T | null = null
  /**
   * The current status of the resource.
   */
  let status: ResourceStatus = 'uninitialized'
  /**
   * Promise representing an ongoing initialization attempt, if any.
   */
  let initInProgress: Promise<void> | null = null
  /**
   * The last error encountered during initialization or health checking, if any.
   */
  let lastError: Error | undefined
  /**
   * Timestamp of the last state transition
   */
  let lastStateTransition = new Date()
  /**
   * Handle for the health check interval timer, if active.
   */
  let healthIntervalHandle: ReturnType<typeof setInterval> | null = null
  /**
   * Flag indicating if a health check is currently in progress.
   */
  let healthcheckInProgress: boolean = false
  /**
   * The healing strategy instance for managing heal attempts.
   */
  const healStrategy = makeHealStrategy(heal)
  /**
   * Logger instance
   */
  const _logger = logger === 'off' ? NoOpLogger : !logger ? console : logger
  /**
   * Reference to the returned Resource instance
   */
  let resourceInstance: Resource<T>

  /**
   * Internal log function, formatting the log message and delegating to the
   * configured logger `_logger`.
   */
  function log(level: 'info' | 'error', message: string) {
    _logger[level](`Resource "${name}": ${message}`)
  }

  /**
   * Captures an error into `lastError`, ensuring it is an instance of Error,
   * as basically anything is throwable in JavaScript.
   */
  function captureError(err: unknown) {
    lastError =
      err instanceof Error
        ? (lastError = err)
        : (lastError = new Error(String(err)))
  }

  /**
   * Performs a health check on the resource.
   *
   * This is called internally according to the configured healthcheck
   * schedule, but may also be manually invoked on the return Resource
   * instance.
   */
  async function check(force: boolean = false): Promise<boolean> {
    if (!instance || (!force && status !== 'ready')) return false

    let error: any
    let ok: boolean = false
    try {
      ok = Boolean(await hcCheckFunction(instance))
    } catch (e) {
      error = e
    } finally {
      statusTransition(ok ? 'ready' : 'failed')
      if (error) captureError(error)
    }

    return ok
  }

  /**
   * Starts the recurring healthchecks according to the configured
   * healthcheck schedule.
   *
   * Invoked after the Resource state transitions to `ready` to monitor
   * the continued availability of the Resource.
   *
   * @internal
   */
  function startHealthCheck() {
    if (healthIntervalHandle) return

    healthIntervalHandle = setInterval(
      async () => {
        if (healthcheckInProgress) return
        healthcheckInProgress = true
        try {
          await check()
        } finally {
          healthcheckInProgress = false
        }
      },
      msInterval(hcInterval, hcUnit)
    )
  }

  /**
   * Schedules an attempt to heal the resource after it has entered
   * a `failed` state.
   *
   * Invoked internally whenever the Resource transitions to `failed`,
   * and after each failed heal attempt to schedule the next attempt.
   *
   * @internal
   */
  function scheduleHealAttempt() {
    const interval = healStrategy.nextInterval()
    if (interval === -1) return
    log('info', `Scheduling heal attempt in ${interval} ms.`)
    healStrategy.timeoutHandle = setTimeout(async () => {
      healStrategy.timeoutHandle = null
      await attemptHeal()
    }, interval)
  }

  /**
   * Attempts to heal the resource by re-invoking the initialization
   * routine.
   *
   * Invoked internally when a scheduled heal attempt is due.
   * If a heal attempt is already in progress, or if the Resource is
   * not in a `failed` state, this is a no-op.
   *
   * @internal
   */
  async function attemptHeal() {
    if (healStrategy.inProgress) return
    if (status !== 'failed') return

    log('info', 'Performing heal attempt.')
    healStrategy.inProgress = true

    try {
      await init()
    } catch {
      // swallow error- init() handles status transitions
    } finally {
      healStrategy.inProgress = false
      reconcileHealing()
    }
  }

  /**
   * Reconciles the healing scheduling state based on the current status.
   *
   * If the Resource is in a `failed` state and no heal attempt is
   * scheduled, this will schedule a heal attempt.
   *
   * If the Resource is not in a `failed` state and a heal attempt
   * is scheduled, this will cancel the scheduled heal attempt
   * and reset the healing strategy.
   *
   * Invoked as part of each state transition.
   *
   * @internal
   */
  function reconcileHealing() {
    if (status === 'failed' && !healStrategy.timeoutHandle) {
      scheduleHealAttempt()
    }

    if (status !== 'failed' && healStrategy.timeoutHandle) {
      healStrategy.reset()
    }
  }

  /**
   * Reconciles the healthcheck scheduling state based on the current status.
   *
   * If the Resource is in a `ready` state and no healthcheck interval
   * is active, this will start the healthcheck interval.
   *
   * If the Resource is not in a `ready` state and a healthcheck
   * interval is active, this will stop the healthcheck interval.
   *
   * Invoked as part of each state transition.
   *
   * @internal
   */
  function reconcileHealthcheck() {
    if (status === 'ready' && !healthIntervalHandle) {
      startHealthCheck()
    }

    if (status !== 'ready' && healthIntervalHandle) {
      clearInterval(healthIntervalHandle)
      healthIntervalHandle = null
    }
  }

  /**
   * Transitions the Resource to the specified status, reconciling
   * healthcheck and healing scheduling as needed.
   *
   * This is the one and only place where `status` may be reassigned
   * once the Resource has been created.
   *
   * @internal
   */
  function statusTransition(next: ResourceStatus) {
    if (status !== next && status !== 'uninitialized') {
      log(
        next === 'failed' ? 'error' : 'info',
        `Transitioned from "${status}" to "${next}".`
      )
    }
    status = next
    lastStateTransition = new Date()

    if (status == 'failed' && instance) {
      close(false).then(() => {
        log('info', 'Disposed of faulty instance')
      })
    }
    reconcileHealthcheck()
    reconcileHealing()
  }

  /**
   * Initializes the resource by invoking the provided `initialize` function
   * and inspecting the results.
   *
   * If the Resource is already in a `ready` state, this is a no-op.
   * If an initialization attempt is already in progress, the Promise
   * representing that attempt is returned.
   *
   * If initialization is successful, the Resource transitions to
   * `ready`. If initialization fails, the Resource transitions to `failed`.
   *
   * @returns A Promise that resolves when initialization is complete.
   */
  async function init() {
    if (status === 'ready') return
    if (initInProgress) return initInProgress

    statusTransition('initializing')

    initInProgress = (async () => {
      try {
        instance = await initialize()
        const ok = await check(true)
        if (ok) {
          statusTransition('ready')
          lastError = undefined
        }
      } catch (err) {
        statusTransition('failed')
        captureError(err)
        log('error', `Initialization failed - ${lastError?.message}`)
        throw err
      } finally {
        initInProgress = null
      }
    })()

    return initInProgress
  }

  /**
   * Gets the underlying resource instance.
   *
   * Every usage of the resource in the normal application flow should call
   * this function to access the resource instance, and the application should
   * never store any references to the returned resource.
   *
   * If the Resource is not in a `ready` state, this throws an Error.
   *
   * @returns The underlying resource instance.
   */
  function get(): T {
    if (status !== 'ready' || !instance) {
      throw new ResourceNotReady(
        `Resource ${name} is not ready (${status})`,
        resourceInstance,
        lastError
      )
    }
    return instance
  }

  /**
   * Tears down the resource accordig to the configured `teardown` method.
   *
   * This is typically never called by the application itself, unless it implements
   * a "controlled shutdown" mechanism (which no ONECore application does at the time
   * of writing).
   *
   * Used internally to dispose of resource instances after re-initialization.
   */
  async function close(transition: boolean = true) {
    if (instance && teardown) {
      log('info', 'Attemping tear down.')
      await teardown(instance)
      instance = null
    }
    if (transition) statusTransition('closed')
  }

  /**
   * Construct a Resource instance from the defined public members above, making
   * it available for inclusion in thrown ResourceError.
   */
  resourceInstance = {
    get,
    check,
    init,
    close: () => close(),
    get name() {
      return name
    },
    get status() {
      return status
    },
    get healStatus(): HealStatus {
      if (healStrategy.inProgress) return 'in-progress'
      if (healStrategy.timeoutHandle) return 'scheduled'
      return 'not-scheduled'
    },
    get lastError() {
      return lastError
    },
    get stateTimestamp() {
      return lastStateTransition
    },
  }

  if (autoInit) {
    init()
      .then(() => {})
      .catch(() => {})
  }

  return resourceInstance
}
