import { OkapiRouter } from 'koa-okapi-router'
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import {
  createReleaseNote,
  deleteReleaseNote,
  getReleaseNoteById,
  listReleaseNotes,
  updateReleaseNote,
} from './adapters/db'

const ErrorResponseSchema = z.object({
  error: z.string(),
})

const DeletedResponseSchema = z.object({
  id: z.string().uuid(),
})

// OkapiRouter schemas are docs-only, so handlers validate input themselves.
const ListQuerySchema = z.object({
  app: communication.ReleaseNoteAppSchema.optional(),
  includeDrafts: z.enum(['true', 'false']).optional(),
})

const IdSchema = z.string().uuid()

const idParam = {
  id: { description: 'Release note id (UUID)', schema: z.string().uuid() },
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'unknown error'

// No auth here: core gates writes on the release-notes:write realm role.
export const routes = (router: OkapiRouter) => {
  router.get(
    '/release-notes',
    {
      summary: 'List release notes',
      description:
        'Pinned notes first, then newest. Drafts and scheduled notes are ' +
        'excluded unless includeDrafts=true.',
      tags: ['Release notes'],
      query: {
        app: {
          description: 'Only notes concerning this app',
          schema: z.optional(communication.ReleaseNoteAppSchema),
        },
        includeDrafts: {
          description: 'Include drafts and scheduled notes',
          schema: z.optional(z.boolean()),
        },
      },
      response: {
        200: z.array(communication.ReleaseNoteSchema),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = ListQuerySchema.safeParse(ctx.query)
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: 'Invalid query parameters' }
        return
      }

      try {
        ctx.status = 200
        ctx.body = await listReleaseNotes({
          app: parsed.data.app,
          includeDrafts: parsed.data.includeDrafts === 'true',
        })
      } catch (error) {
        logger.error({ err: error }, 'failed to list release notes')
        ctx.status = 500
        ctx.body = { error: errorMessage(error) }
      }
    }
  )

  router.get(
    '/release-notes/:id',
    {
      summary: 'Get a release note by id',
      tags: ['Release notes'],
      params: idParam,
      response: {
        200: communication.ReleaseNoteSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      if (!IdSchema.safeParse(ctx.params.id).success) {
        ctx.status = 404
        ctx.body = { error: 'Release note not found' }
        return
      }

      try {
        const note = await getReleaseNoteById(ctx.params.id)
        if (!note) {
          ctx.status = 404
          ctx.body = { error: 'Release note not found' }
          return
        }
        ctx.status = 200
        ctx.body = note
      } catch (error) {
        logger.error({ err: error }, 'failed to get release note')
        ctx.status = 500
        ctx.body = { error: errorMessage(error) }
      }
    }
  )

  router.post(
    '/release-notes',
    {
      summary: 'Create a release note',
      description:
        'Omit publishedAt (or pass null) to save the note as a draft.',
      tags: ['Release notes'],
      body: communication.CreateReleaseNoteParamsSchema,
      response: {
        201: communication.ReleaseNoteSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      const parsed = communication.CreateReleaseNoteParamsSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: parsed.error.message }
        return
      }

      try {
        ctx.status = 201
        ctx.body = await createReleaseNote(parsed.data)
      } catch (error) {
        logger.error({ err: error }, 'failed to create release note')
        ctx.status = 500
        ctx.body = { error: errorMessage(error) }
      }
    }
  )

  router.put(
    '/release-notes/:id',
    {
      summary: 'Update a release note',
      description:
        'Only the supplied fields change. Pass publishedAt: null to unpublish.',
      tags: ['Release notes'],
      params: idParam,
      body: communication.UpdateReleaseNoteSchema,
      response: {
        200: communication.ReleaseNoteSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      if (!IdSchema.safeParse(ctx.params.id).success) {
        ctx.status = 404
        ctx.body = { error: 'Release note not found' }
        return
      }

      const parsed = communication.UpdateReleaseNoteSchema.safeParse(
        ctx.request.body
      )
      if (!parsed.success) {
        ctx.status = 400
        ctx.body = { error: parsed.error.message }
        return
      }
      if (Object.keys(parsed.data).length === 0) {
        ctx.status = 400
        ctx.body = { error: 'No fields to update' }
        return
      }

      try {
        const updated = await updateReleaseNote(ctx.params.id, parsed.data)
        if (!updated) {
          ctx.status = 404
          ctx.body = { error: 'Release note not found' }
          return
        }
        ctx.status = 200
        ctx.body = updated
      } catch (error) {
        logger.error({ err: error }, 'failed to update release note')
        ctx.status = 500
        ctx.body = { error: errorMessage(error) }
      }
    }
  )

  router.delete(
    '/release-notes/:id',
    {
      summary: 'Delete a release note',
      tags: ['Release notes'],
      params: idParam,
      response: {
        200: DeletedResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      if (!IdSchema.safeParse(ctx.params.id).success) {
        ctx.status = 404
        ctx.body = { error: 'Release note not found' }
        return
      }

      try {
        const deleted = await deleteReleaseNote(ctx.params.id)
        if (!deleted) {
          ctx.status = 404
          ctx.body = { error: 'Release note not found' }
          return
        }
        ctx.status = 200
        ctx.body = { id: ctx.params.id }
      } catch (error) {
        logger.error({ err: error }, 'failed to delete release note')
        ctx.status = 500
        ctx.body = { error: errorMessage(error) }
      }
    }
  )
}
