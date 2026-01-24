import { type Resource } from '@/resource'

export type SystemStatus = 'active' | 'impaired' | 'failure' | 'unknown'

/**
 * Public representation of system health. May be nested.
 */
export interface SystemHealth {
  name: string
  status: SystemStatus
  subsystems?: SystemHealth[]
  statusMessage?: string
  timeStamp: Date
}

/**
 * Interface for any object/instance that provides a `probe`-function
 * for use with `probeSystemHealth`.
 */
export interface HealthCheckTarget {
  probe(): Promise<SystemHealth>
}

/**
 * Create a SystemHealth object representing an error state.
 *
 * @param name The name of the system/aspect.
 * @param error The error that occurred.
 *
 * @returns A SystemHealth object representing the error state.
 */
const makeErrorSystemHealth = (
  name: string,
  error?: any,
  timestamp?: Date
): SystemHealth => {
  if (error instanceof ReferenceError) {
    return {
      status: 'impaired',
      statusMessage: error?.message || 'Reference error ' + name,
      name,
      timeStamp: timestamp ?? new Date(),
    }
  } else {
    return {
      status: 'failure',
      statusMessage: error?.message || 'Failed to access ' + name,
      name,
      timeStamp: timestamp ?? new Date(),
    }
  }
}

/**
 * Create a SystemHealth object representing an active state.
 *
 * @param name The name of the system/aspect.
 * @param activeMessage Optional message to include in the status.
 *
 * @returns A SystemHealth object representing the active state.
 */
const makeActiveSystemHealth = (
  name: string,
  timestamp?: Date,
  activeMessage?: string
): SystemHealth => {
  return {
    status: 'active',
    name,
    timeStamp: timestamp ?? new Date(),
    ...(activeMessage ? { statusMessage: activeMessage } : {}),
  }
}

/**
 * Perform a health check probe of a specific target.
 *
 * The `healthChecks` map must be provided by the implementing system, and will
 * be modified to contain the results of this check, overwriting any previous results.
 *
 * @param systemName The name of the system/aspect being probed.
 * @param healthChecks A map of system names to their current health status.
 * @param minimumMinutesBetweenRequests Minimum time in minutes between health checks for the same system.
 * @param checkFunction The function that performs the health check.
 * @param activeMessage Optional message to set if the system is active.
 *
 * @returns A promise that resolves to the health status of the system.
 */
export async function probe(
  systemName: string,
  healthChecks: Map<string, SystemHealth>,
  minimumMinutesBetweenRequests: number,
  checkFunction: () => any,
  activeMessage?: string
): Promise<SystemHealth> {
  let currentHealth = healthChecks.get(systemName)
  if (
    !currentHealth ||
    Math.floor(
      (new Date().getTime() - currentHealth.timeStamp.getTime()) / 60000
    ) >= minimumMinutesBetweenRequests
  ) {
    try {
      const result = await checkFunction()

      if (result) {
        currentHealth = {
          status: result.status,
          name: result.name,
          subsystems: result.subsystems,
          timeStamp: new Date(),
        }
      } else {
        currentHealth = makeActiveSystemHealth(
          systemName,
          new Date(),
          activeMessage
        )
      }
    } catch (error: any) {
      currentHealth = makeErrorSystemHealth(systemName, error)
    }

    healthChecks.set(systemName, currentHealth)
  }
  return currentHealth
}

/**
 * Query the health status of a Resource.
 *
 * The `healthChecks` map must be provided by the implementing system, and will
 * be modified to contain the results of this check, overwriting any previous results.
 *
 * Resources carry out their own health checks on a schedule, and unlike a regular probe
 * this variant merely queries the status of the Resource.
 *
 * @param resource The Resource to be probed.
 * @param healthChecks A map of system names to their current health status.
 * @param activeMessage Optional message to set if the system is active.
 *
 * @return A promise that resolves to the health status of the Resource.
 */
export const probeResource = async (
  resource: Resource<any>,
  healthChecks: Map<string, SystemHealth>,
  activeMessage?: string
): Promise<SystemHealth> => {
  let currentHealth: SystemHealth | undefined
  switch (resource.status) {
    case 'ready':
      currentHealth = makeActiveSystemHealth(
        resource.name,
        resource.stateTimestamp,
        activeMessage
      )
      break
    case 'failed':
    case 'uninitialized':
    case 'initializing':
    case 'closed':
      currentHealth = makeErrorSystemHealth(
        resource.name,
        resource.lastError,
        resource.stateTimestamp
      )
      break
    default:
      currentHealth = {
        status: 'unknown',
        name: resource.name,
        timeStamp: resource.stateTimestamp,
      }
  }
  healthChecks.set(resource.name, currentHealth)

  return currentHealth
}

/**
 * Perform sequential health checks against all provided targets
 * and aggregate the results into a single `SystemHealth` object.
 *
 * @param serviceName The name of the service/system performing the probe.
 * @param subsystems An array of `HealthCheckTarget` objects to probe.
 * @return A promise that resolves to a `SystemHealth` object containing the aggregated health status.
 *
 * @throws Will throw an error if any of the subsystem probes fail.
 */
export const pollSystemHealth = async (
  serviceName: string,
  subsystems: HealthCheckTarget[]
): Promise<SystemHealth> => {
  const health: SystemHealth = {
    name: serviceName,
    status: 'active',
    subsystems: [],
    statusMessage: '',
    timeStamp: new Date(),
  }

  // Iterate over subsystems
  for (const subsystem of subsystems) {
    const subsystemHealth = await subsystem.probe()
    health.subsystems?.push(subsystemHealth)

    switch (subsystemHealth.status) {
      case 'failure':
        health.status = 'failure'
        health.statusMessage = 'Failure because of failing subsystem'
        break
      case 'impaired':
        if (health.status !== 'failure') {
          health.status = 'impaired'
          health.statusMessage = 'Failure because of impaired subsystem'
        }
        break
      case 'unknown':
        if (health.status !== 'failure' && health.status !== 'impaired') {
          health.status = 'unknown'
          health.statusMessage = 'Unknown because subsystem status is unknown'
        }
        break
      default:
        break
    }
  }

  return health
}
