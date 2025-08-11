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
export const probe = async (
  systemName: string,
  healthChecks: Map<string, SystemHealth>,
  minimumMinutesBetweenRequests: number,
  checkFunction: () => any,
  activeMessage?: string
): Promise<SystemHealth> => {
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
        currentHealth = {
          status: 'active',
          name: systemName,
          timeStamp: new Date(),
        }
        if (activeMessage) currentHealth.statusMessage = activeMessage
      }
    } catch (error: any) {
      if (error instanceof ReferenceError) {
        currentHealth = {
          status: 'impaired',
          statusMessage: error.message || 'Reference error ' + systemName,
          name: systemName,
          timeStamp: new Date(),
        }
      } else {
        currentHealth = {
          status: 'failure',
          statusMessage: error.message || 'Failed to access ' + systemName,
          name: systemName,
          timeStamp: new Date(),
        }
      }
    }

    healthChecks.set(systemName, currentHealth)
  }
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
