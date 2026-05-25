import { logger } from '@onecore/utilities'
import type { z } from 'zod'
import { inspection } from '@onecore/types'

import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import type { InternalInspection } from '../../../adapters/inspection-adapter'

// Inspectors enter Swedish condition labels; the property service stores
// English values. Anything not in this map is skipped silently with a warn log.
const CONDITION_MAPPING: Record<string, 'GOOD' | 'FAIR' | 'DAMAGED'> = {
  God: 'GOOD',
  Acceptabel: 'FAIR',
  Skadad: 'DAMAGED',
}

// User-facing Swedish messages for adapter error codes. The internal codes
// stay in logs (componentId is included); the UI renders only `message`.
const ERROR_MESSAGES: Record<'upstream_error' | 'not_found', string> = {
  not_found: 'Komponenten hittades inte',
  upstream_error: 'Kunde inte uppdatera komponenten',
}

export type ComponentWriteBackError = z.infer<
  typeof inspection.ComponentWriteBackErrorSchema
>

type WriteBackTask = {
  componentId: string
  componentLabel: string
  mappedCondition: 'GOOD' | 'FAIR' | 'DAMAGED'
}

/**
 * Best-effort write-back of component condition + lastInspectionDate to
 * property-base for every component in a freshly-completed inspection.
 * Per-component PUTs run in parallel via Promise.allSettled — latency is
 * ~1 RTT regardless of component count, instead of N × RTT. Continues on
 * individual failures and returns the aggregated error list, which core's
 * PATCH route attaches to the response so the UI can surface it.
 */
export const writeBackComponentInspectionStates = async (
  inspection: InternalInspection
): Promise<ComponentWriteBackError[]> => {
  if (!inspection.rooms || inspection.endedAt === null) {
    return []
  }

  const lastInspectionDate = inspection.endedAt
  const tasks: WriteBackTask[] = []

  for (const room of inspection.rooms) {
    if (!room.components) continue

    for (const component of room.components) {
      if (!component.condition) continue

      const mappedCondition = CONDITION_MAPPING[component.condition]
      if (!mappedCondition) {
        logger.warn(
          {
            componentId: component.componentId,
            condition: component.condition,
          },
          'Unknown condition value, skipping component write-back'
        )
        continue
      }

      tasks.push({
        componentId: component.componentId,
        componentLabel: component.label,
        mappedCondition,
      })
    }
  }

  const settled = await Promise.allSettled(
    tasks.map((task) =>
      propertyBaseAdapter.updateComponentInspectionState(task.componentId, {
        condition: task.mappedCondition,
        lastInspectionDate,
      })
    )
  )

  const errors: ComponentWriteBackError[] = []
  settled.forEach((outcome, index) => {
    const task = tasks[index]
    if (outcome.status === 'rejected') {
      // The adapter catches its own errors and returns `{ ok: false, err }`,
      // so a rejected promise here means an unexpected throw — log it and
      // surface as 'unknown' rather than crashing the whole PATCH.
      logger.error(
        { err: outcome.reason, componentId: task.componentId },
        'updateComponentInspectionState threw unexpectedly'
      )
      errors.push({
        componentId: task.componentId,
        componentLabel: task.componentLabel,
        message: ERROR_MESSAGES.upstream_error,
      })
      return
    }
    if (!outcome.value.ok) {
      errors.push({
        componentId: task.componentId,
        componentLabel: task.componentLabel,
        message: ERROR_MESSAGES[outcome.value.err],
      })
    }
  })

  return errors
}
