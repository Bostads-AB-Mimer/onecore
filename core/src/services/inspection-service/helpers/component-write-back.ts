import { logger } from '@onecore/utilities'
import type { z } from 'zod'
import { inspection } from '@onecore/types'

import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import type { InternalInspection } from '../../../adapters/inspection-adapter'
import { formatSwedishDate } from '../../../utils/date'

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

// One message for every INSPECTED event failure, distinct from the condition
// messages so a component that fails both shows two separate rows. The
// adapter's error code is logged instead.
const EVENT_ERROR_MESSAGE = 'Kunde inte spara besiktningshändelsen'

export type ComponentWriteBackError = z.infer<
  typeof inspection.ComponentWriteBackErrorSchema
>

type WriteBackTask = {
  componentId: string
  componentLabel: string
  condition: string
  mappedCondition: 'GOOD' | 'FAIR' | 'DAMAGED'
}

/**
 * Best-effort write-back of component condition + lastInspectionDate to
 * property-base for every component in a freshly-completed inspection, plus
 * an INSPECTED component event per component. The condition PUTs and the
 * event POSTs are independent and run concurrently in one wave — latency is
 * ~1 RTT regardless of component count, instead of N × RTT.
 * Continues on individual failures and returns the aggregated error list,
 * which core's PATCH route attaches to the response so the UI can surface it.
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
        condition: component.condition,
        mappedCondition,
      })
    }
  }

  // The event's actor is the inspector who did the inspection, not the user
  // completing it. Without one the event would be rejected (actor is required).
  const actor = inspection.inspector.trim()
  if (tasks.length > 0 && !actor) {
    logger.warn(
      { inspectionId: inspection.id },
      'Inspection has no inspector, skipping component events'
    )
  }
  const occurredAt = formatSwedishDate(inspection.endedAt)

  const [conditionResults, eventResults] = await Promise.all([
    Promise.allSettled(
      tasks.map((task) =>
        propertyBaseAdapter.updateComponentInspectionState(task.componentId, {
          condition: task.mappedCondition,
          lastInspectionDate,
        })
      )
    ),
    Promise.allSettled(
      actor
        ? tasks.map((task) =>
            propertyBaseAdapter.createComponentEvent(task.componentId, {
              eventType: 'INSPECTED',
              sourceType: 'INSPECTION',
              sourceId: inspection.id,
              occurredAt,
              actor,
              note: task.condition,
            })
          )
        : []
    ),
  ])

  const errors: ComponentWriteBackError[] = []
  conditionResults.forEach((outcome, index) => {
    const task = tasks[index]
    if (outcome.status === 'rejected') {
      // The adapter catches its own errors and returns `{ ok: false, err }`,
      // so a rejected promise here means an unexpected throw — log it and
      // surface it with the upstream_error message rather than crashing the
      // whole PATCH.
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

  tasks.forEach((task, index) => {
    const eventError = {
      componentId: task.componentId,
      componentLabel: task.componentLabel,
      message: EVENT_ERROR_MESSAGE,
    }
    // No event was attempted because the inspection has no inspector
    if (!actor) {
      errors.push(eventError)
      return
    }
    const outcome = eventResults[index]
    if (outcome.status === 'rejected') {
      logger.error(
        { err: outcome.reason, componentId: task.componentId },
        'createComponentEvent threw unexpectedly'
      )
      errors.push(eventError)
      return
    }
    if (!outcome.value.ok) {
      // A 200 (event already recorded, e.g. a concurrent double submit) is ok;
      // this is a real failure. The adapter already logs upstream_error as an
      // error. The other codes mean a component from the inspection is missing
      // or core sent a body the property service rejected (bad_request carries
      // its reason), so they are logged as errors here.
      const logContext = {
        inspectionId: inspection.id,
        componentId: task.componentId,
        err: outcome.value.err,
        message: outcome.value.message,
      }
      if (outcome.value.err === 'upstream_error') {
        logger.warn(logContext, 'Failed to create INSPECTED component event')
      } else {
        logger.error(logContext, 'Failed to create INSPECTED component event')
      }
      errors.push(eventError)
    }
  })

  return errors
}
