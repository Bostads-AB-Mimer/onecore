import { ComponentEvents, Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'
import { property } from '@onecore/types'
import { prismaErrorCode } from '@src/utils/prisma-errors'
import { prisma } from './db'

// ==================== COMPONENT EVENTS ====================

const newestFirst: Prisma.ComponentEventsOrderByWithRelationInput[] = [
  { occurredAt: 'desc' },
  { createdAt: 'desc' },
]

const sameId = (a?: string | null, b?: string | null) =>
  (a ?? '').toLowerCase() === (b ?? '').toLowerCase()

export const componentExists = async (id: string) =>
  (await prisma.components.count({ where: { id } })) > 0

// The idempotency key is the filtered unique index
// UX_component_events_source_component_event. Prisma cannot model it, so no
// upsert: callers look for a repeat first, and create looks again if a
// concurrent insert wins.
export const findRepeatedComponentEvent = async (
  componentId: string,
  data: property.CreateComponentEvent
): Promise<ComponentEvents | null> => {
  if (!data.sourceId) return null

  const existing = await prisma.componentEvents.findFirst({
    where: {
      componentId,
      eventType: data.eventType,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
    },
  })

  if (
    existing &&
    (existing.occurredAt.toISOString().slice(0, 10) !== data.occurredAt ||
      existing.actor !== data.actor ||
      (existing.note ?? null) !== (data.note ?? null) ||
      !sameId(existing.relatedComponentId, data.relatedComponentId))
  ) {
    logger.warn(
      { eventId: existing.id, sourceId: data.sourceId },
      'component-event-adapter.findRepeatedComponentEvent: repeated event differs from the stored one, keeping the stored one'
    )
  }

  return existing
}

export const createComponentEvent = async (
  componentId: string,
  data: property.CreateComponentEvent
): Promise<{ created: boolean; event: ComponentEvents }> => {
  try {
    const event = await prisma.componentEvents.create({
      data: {
        componentId,
        eventType: data.eventType,
        occurredAt: new Date(data.occurredAt),
        sourceType: data.sourceType,
        sourceId: data.sourceId ?? null,
        relatedComponentId: data.relatedComponentId ?? null,
        actor: data.actor,
        note: data.note ?? null,
      },
    })
    return { created: true, event }
  } catch (err) {
    if (prismaErrorCode(err) === 'P2002') {
      const existing = await findRepeatedComponentEvent(componentId, data)
      if (existing) return { created: false, event: existing }
    }
    logger.error({ err }, 'component-event-adapter.createComponentEvent')
    throw err
  }
}

export const getComponentEvents = (componentId: string) =>
  prisma.componentEvents.findMany({
    where: { componentId },
    orderBy: newestFirst,
  })

export const getComponentEventsBySource = (
  sourceType: property.ComponentEventSourceType,
  sourceId: string
) =>
  prisma.componentEvents.findMany({
    where: { sourceType, sourceId },
    orderBy: newestFirst,
  })
