import { logger } from '@onecore/utilities'

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
const ERROR_MESSAGES: Record<'not_found' | 'update-failed', string> = {
  not_found: 'Komponenten hittades inte',
  'update-failed': 'Kunde inte uppdatera komponenten',
}

export type ComponentWriteBackError = {
  componentId: string
  componentLabel: string
  message: string
}

/**
 * Best-effort write-back of component condition + lastInspectionDate to
 * property-base for every component in a freshly-completed inspection.
 * Continues on per-component failures and returns the aggregated error list,
 * which core's PATCH route attaches to the response so the UI can surface it.
 */
export const writeBackComponentInspectionStates = async (
  inspection: InternalInspection
): Promise<ComponentWriteBackError[]> => {
  const errors: ComponentWriteBackError[] = []

  if (!inspection.rooms || inspection.endedAt === null) {
    return errors
  }

  const lastInspectionDate = inspection.endedAt

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

      const result = await propertyBaseAdapter.updateComponentInspectionState(
        component.componentId,
        { condition: mappedCondition, lastInspectionDate }
      )

      if (!result.ok) {
        errors.push({
          componentId: component.componentId,
          componentLabel: component.label,
          message: ERROR_MESSAGES[result.err],
        })
      }
    }
  }

  return errors
}
