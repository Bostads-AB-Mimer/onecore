import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { property } from '@onecore/types'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  ComponentEventSchema,
  ComponentEventsBySourceQuerySchema,
} from '../types/component'
import {
  componentExists,
  findRepeatedComponentEvent,
  createComponentEvent,
  getComponentEvents,
  getComponentEventsBySource,
} from '../adapters/component-adapter'
import { prismaErrorCode } from '../utils/prisma-errors'

/**
 * @swagger
 * tags:
 *   - name: Component Events
 *     description: History of what happened to a component (installed, repaired, replaced, inspected, ...)
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /components/{id}/events:
   *   post:
   *     summary: Record an event on a component
   *     description: |
   *       Stores what happened to a component (repaired, replaced, inspected, ...).
   *       Idempotent on (sourceType, sourceId, componentId, eventType) when sourceId is set:
   *       a repeated request returns the stored event unchanged with 200 instead of 201.
   *       sourceId is required unless sourceType is MANUAL.
   *     tags: [Component Events]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentEventRequest'
   *     responses:
   *       201:
   *         description: Event created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentEvent'
   *       200:
   *         description: The event already existed and is returned unchanged
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentEvent'
   *       400:
   *         description: Invalid request, or relatedComponentId does not exist
   *       404:
   *         description: Component not found
   *       500:
   *         description: Internal server error
   */
  router.post(
    '(.*)/components/:id/events',
    parseRequest({ body: property.CreateComponentEventSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const idResult = z.string().uuid().safeParse(ctx.params.id)
      if (!idResult.success) {
        ctx.status = 400
        ctx.body = { error: 'Invalid UUID format', ...metadata }
        return
      }
      const id = idResult.data
      // parseRequest has already validated the body against this schema
      const body = ctx.request.parsedBody as property.CreateComponentEvent

      try {
        if (!(await componentExists(id))) {
          ctx.status = 404
          ctx.body = { error: 'Component not found', ...metadata }
          return
        }

        // A retry gets the stored event back before anything else is
        // validated, so it still succeeds if the related component is gone
        const repeated = await findRepeatedComponentEvent(id, body)
        if (repeated) {
          ctx.status = 200
          ctx.body = {
            content: ComponentEventSchema.parse(repeated),
            ...metadata,
          }
          return
        }

        if (body.relatedComponentId) {
          if (body.relatedComponentId.toLowerCase() === id.toLowerCase()) {
            ctx.status = 400
            ctx.body = {
              error: 'relatedComponentId cannot be the component itself',
              ...metadata,
            }
            return
          }
          if (!(await componentExists(body.relatedComponentId))) {
            ctx.status = 400
            ctx.body = {
              error: 'Invalid relatedComponentId: component does not exist',
              ...metadata,
            }
            return
          }
        }

        const { created, event } = await createComponentEvent(id, body)
        ctx.status = created ? 201 : 200
        ctx.body = {
          content: ComponentEventSchema.parse(event),
          ...metadata,
        }
      } catch (err) {
        // The component was deleted between the check and the insert
        if (prismaErrorCode(err) === 'P2003') {
          ctx.status = 404
          ctx.body = { error: 'Component not found', ...metadata }
          return
        }
        logger.error({ err }, 'componentEventRoutes.create')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/{id}/events:
   *   get:
   *     summary: List a component's events
   *     description: All events recorded on the component, newest first.
   *     tags: [Component Events]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *     responses:
   *       200:
   *         description: The component's events
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentEvent'
   *       400:
   *         description: Invalid UUID format
   *       404:
   *         description: Component not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/components/:id/events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const idResult = z.string().uuid().safeParse(ctx.params.id)
    if (!idResult.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid UUID format', ...metadata }
      return
    }
    const id = idResult.data

    try {
      const events = await getComponentEvents(id)
      // Only an empty history needs telling apart from an unknown component
      if (events.length === 0 && !(await componentExists(id))) {
        ctx.status = 404
        ctx.body = { error: 'Component not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentEventSchema.array().parse(events),
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, 'componentEventRoutes.getByComponent')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /component-events:
   *   get:
   *     summary: List the component events of one work order or inspection
   *     description: All events with the given source, newest first. An unknown source gives an empty list.
   *     tags: [Component Events]
   *     parameters:
   *       - in: query
   *         name: sourceType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [WORK_ORDER, INSPECTION, MANUAL]
   *       - in: query
   *         name: sourceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Work order id (e.g. od-123) or inspection id
   *     responses:
   *       200:
   *         description: The events
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentEvent'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/component-events',
    parseRequest({ query: ComponentEventsBySourceQuerySchema }),
    async (ctx) => {
      // parseRequest has already validated the query against this schema
      const { sourceType, sourceId } = ctx.request
        .parsedQuery as property.ComponentEventsBySourceQuery
      const metadata = generateRouteMetadata(ctx, ['sourceType', 'sourceId'])

      try {
        const events = await getComponentEventsBySource(sourceType, sourceId)
        ctx.body = {
          content: ComponentEventSchema.array().parse(events),
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'componentEventRoutes.getBySource')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )
}
