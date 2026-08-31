import { msInterval, type Unit } from './interval'

/**
 * Union type of all valid concrete Healing strategy
 * options/configurations
 */
export type HealOptions =
  | HealFixedIntervalOptions
  | HealIncrementalBackoffOptions
  | HealExponentialBackoffOptions
  | HealDisabledOptions

/**
 * Automatic healing attempts disabled.
 *
 * Using this will disable the automatic healing feature, and will keep
 * a Resource in a failed state unless it is of a nature that does not
 * require re-initialization to resume operations.
 *
 * A database connection/pool is likely to require re-initialization,
 * whereas an HTTP client resource likely does not.
 */
export type HealDisabledOptions = {
  strategy: 'off'
}

/**
 * Base type for all non-"off" healing strategies. Not valid on its own.
 */
export type HealStrategyOptionsBase = {
  timeUnit?: Unit
  initialDelay?: number
}

/**
 * Options for the fixed interval healing strategy.
 */
export type HealFixedIntervalOptions = HealStrategyOptionsBase & {
  /**
   * Discriminator value for fixed interval healing.
   */
  strategy: 'fixed-interval'
  /**
   * The fixed interval at which heal attempts will occur, expressed
   * in `timeUnit`.
   */
  interval?: number
}

/**
 * Base type for all backoff-based healing strategies. Not valid on its own.
 */
export type HealBackoffOptionsBase = HealStrategyOptionsBase & {
  maxInterval?: number
}

/**
 * Options for an incremental backoff healing strategy, that increases
 * the time between attempts with a fixed interval.
 */
export type HealIncrementalBackoffOptions = HealBackoffOptionsBase & {
  /**
   * Discriminator value for incremental backoff healing.
   */
  strategy: 'incremental-backoff'
  /**
   * The fixed interval with which to increase the timeout between
   * each attempt to heal the resource.
   */
  increment?: number
}

/**
 * Options for an exponential backoff healing strategy, that increases
 * the time between attempts exponentially.
 */
export type HealExponentialBackoffOptions = HealBackoffOptionsBase & {
  /**
   * Discriminator value for exponential backoff healing.
   */
  strategy: 'exponential-backoff'
}

/**
 * The healing strategy type used by Resource.
 *
 * Contains the concrete HealOptions as supplied when constructing a
 * Resource, with defaults applied where the supplied HealOptions has
 * left optional values empty.
 */
export type HealStrategy = {
  /**
   * Concrete options and configuration for heal attempts
   */
  options: HealOptions
  /**
   * Function that returns the interval after which the next heal attempt
   * should be scheduled according to the configured strategy.
   *
   * Returns -1 if no healing attempt should be scheduled.
   *
   * This function should be called whenever a heal attempt is scheduled.
   *
   * Returns the interval in milliseconds.
   */
  nextInterval: () => number
  /**
   * Resets the healing strategy back to its original state.
   *
   * This function should be called whenever a Resource transitions from
   * a non-ready state to a ready state.
   */
  reset: () => void
  /**
   * Handle to the currently scheduled timeout for the next heal attempt,
   * or null if no heal attempt is currently scheduled.
   *
   * Used internally by Resource to manage heal attempt scheduling, making
   * multiple and independent healing attempts are not issued, as well as
   * clearing any scheduled attempt that is no longer necessary.
   */
  timeoutHandle: ReturnType<typeof setTimeout> | null
  /**
   * Indicates whether a heal attempt is currently in progress.
   * Used internally by Resource to avoid concurrent heal attempts.
   *
   * When a heal attempt is started, this flag is set to true, and
   * set to false when the attempt completes, regardless of whether it is
   * successful or not.
   */
  inProgress: boolean
}

/**
 * Constructs a concrete and fully configured HealOptions instance from
 * the input instance according to the indicated strategy.
 *
 * Regardless of the selected `timeUnit` of the input, the resulting
 * concrete instances returned by this function converts all intervals
 * to use `ms`/milliseconds.
 *
 * If no input is provided, defaults to an exponential backoff strategy
 * with an initial delay of 1 seconds and a maximum interval of 1 minute.
 *
 * If the 'off' strategy is selected, the input instance is returned
 * as-is.
 *
 * This function is used internally by `makeHealStrategy` to ensure
 * a fully configured HealOptions instance is always available.
 *
 * See the documentation of each healing strategy type for details
 * on the default values applied by this function.
 *
 * @param opts Optional HealOptions instance to apply defaults to.
 *
 * @returns A concrete HealOptions instance with all required values
 *          populated.
 */
export const applyDefaults = (opts?: HealOptions): HealOptions => {
  if (!opts) {
    return {
      strategy: 'exponential-backoff',
      timeUnit: 'ms',
      initialDelay: msInterval(1, 's'),
      maxInterval: msInterval(1, 'm'),
    }
  }

  if (opts.strategy === 'off') {
    return opts
  }

  const inputTimeUnit = opts.timeUnit ?? 's'
  const initialDelay = opts.initialDelay
    ? msInterval(opts.initialDelay, inputTimeUnit)
    : msInterval(1, 's')

  switch (opts.strategy) {
    case 'fixed-interval':
      return {
        strategy: 'fixed-interval',
        timeUnit: 'ms',
        initialDelay,
        interval: opts.interval
          ? msInterval(opts.interval, inputTimeUnit)
          : msInterval(30, 's'),
      }
    case 'incremental-backoff':
      return {
        strategy: 'incremental-backoff',
        timeUnit: 'ms',
        initialDelay,
        increment: opts.increment
          ? msInterval(opts.increment, inputTimeUnit)
          : msInterval(15, 's'),
        maxInterval: opts.maxInterval
          ? msInterval(opts.maxInterval, inputTimeUnit)
          : msInterval(10, 'm'),
      }
    case 'exponential-backoff':
      return {
        strategy: 'exponential-backoff',
        timeUnit: 'ms',
        initialDelay,
        maxInterval: opts.maxInterval
          ? msInterval(opts.maxInterval, inputTimeUnit)
          : msInterval(10, 'm'),
      }
  }
}

/**
 * Constructs a HealStrategy instance according to the supplied options.
 *
 * If no options are supplied, defaults to an exponential backoff strategy
 * with an initial delay of 1 seconds and a maximum interval of 1 minute.
 *
 * The returned HealStrategy instance contains methods to determine the
 * next interval for a heal attempt according to the selected strategy,
 * as well as a method to reset the strategy back to its initial state.
 *
 * See the documentation of each healing strategy type for details
 * on the default values applied by this function.
 *
 * @param opts Optional HealOptions instance to configure the strategy.
 *
 * @return A HealStrategy instance configured according to the supplied
 */
export const makeHealStrategy = (opts?: HealOptions): HealStrategy => {
  const options = applyDefaults(opts)
  let state: 'inactive' | 'initial' | 'active' = 'inactive'
  let interval = 0

  return {
    options,
    timeoutHandle: null,
    inProgress: false,
    reset() {
      state = 'inactive'
      this.inProgress = false
      if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    },
    nextInterval() {
      if (options.strategy === 'off') return -1

      if (state === 'inactive') {
        state = 'initial'
        interval = options.initialDelay!
      } else if (state === 'initial') {
        state = 'active'

        switch (options.strategy) {
          case 'fixed-interval':
            interval = options.interval!
            break
          case 'incremental-backoff':
            interval = options.increment!
            break
          case 'exponential-backoff':
            interval *= 2
            break
        }
      } else if (state === 'active') {
        switch (options.strategy) {
          case 'fixed-interval':
            interval = options.interval!
            break
          case 'incremental-backoff':
            interval += options.increment!
            break
          case 'exponential-backoff':
            interval *= 2
            break
        }
        if ('maxInterval' in options && interval > options.maxInterval!) {
          interval = options.maxInterval!
        }
      }

      return interval
    },
  }
}
