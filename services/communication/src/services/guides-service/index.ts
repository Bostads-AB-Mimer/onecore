import { OkapiRouter } from 'koa-okapi-router'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z, ZodError, ZodTypeAny } from 'zod'

import { db } from '../../common/db'
import {
  findOrCreateCategory,
  listCategories,
} from './adapters/categories-adapter'
import {
  createGuide,
  deleteGuide,
  getGuideById,
  getGuideBySlug,
  listGuides,
  updateGuide,
} from './adapters/guides-adapter'
import { createStepImage, deleteStepImage } from './adapters/images-adapter'
import { CategoryNotFoundError, SlugTakenError } from './errors'
import { sanitizeGuideWrite } from './sanitize'

const ErrorResponseSchema = z.object({
  error: z.string(),
  issues: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
      })
    )
    .optional(),
})

const uuidParam = (description: string) => ({
  description,
  schema: z.string().uuid(),
})

// The okapi router only types and documents the schemas; it does not
// validate at runtime, so every handler parses its own input.
class RequestValidationError extends Error {
  constructor(public readonly zodError: ZodError) {
    super('Request validation failed')
    this.name = 'RequestValidationError'
  }
}

const parse = <S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> => {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) throw new RequestValidationError(error)
    throw error
  }
}

type ErrorContext = {
  status: number
  body: unknown
}

// Shared error mapping so every route answers the same way.
const respondWithError = (
  ctx: ErrorContext,
  error: unknown,
  logMessage: string
) => {
  if (error instanceof RequestValidationError) {
    ctx.status = 400
    ctx.body = {
      error: 'Validation failed',
      issues: error.zodError.issues.map(({ path, message }) => ({
        path,
        message,
      })),
    }
    return
  }
  if (error instanceof SlugTakenError) {
    ctx.status = 409
    ctx.body = { error: 'slug-taken' }
    return
  }
  if (error instanceof CategoryNotFoundError) {
    ctx.status = 400
    ctx.body = { error: 'category-not-found' }
    return
  }
  logger.error({ err: error }, logMessage)
  ctx.status = 500
  ctx.body = {
    error: error instanceof Error ? error.message : 'unknown error',
  }
}

export const routes = (router: OkapiRouter) => {
  router.get(
    '/guides',
    {
      summary: 'List guides',
      description:
        'Returns guide summaries ordered by category and title. Drafts are ' +
        'only included when includeDrafts=true.',
      tags: ['Guides'],
      query: {
        includeDrafts: {
          description: 'Include unpublished guides',
          schema: z.enum(['true', 'false']).optional(),
        },
      },
      response: {
        200: z.array(guides.GuideSummarySchema),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const query = parse(guides.ListGuidesQuerySchema, ctx.query)
        ctx.status = 200
        ctx.body = await listGuides(query, db)
      } catch (error) {
        respondWithError(ctx, error, 'failed to list guides')
      }
    }
  )

  router.get(
    '/guides/categories',
    {
      summary: 'List guide categories',
      tags: ['Guides'],
      response: {
        200: z.array(guides.GuideCategorySchema),
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        ctx.status = 200
        ctx.body = await listCategories(db)
      } catch (error) {
        respondWithError(ctx, error, 'failed to list guide categories')
      }
    }
  )

  router.get(
    '/guides/by-slug/:slug',
    {
      summary: 'Get a guide by slug',
      description:
        'Resolves the current slug first and then guide_slug_history. A ' +
        'guide found through history carries redirectedFrom. Drafts are ' +
        'returned; the caller decides who may see them.',
      tags: ['Guides'],
      params: {
        slug: { description: 'Current or previous slug', schema: z.string() },
      },
      response: {
        200: guides.GuideSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const guide = await getGuideBySlug(ctx.params.slug, db)
        if (!guide) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = guide
      } catch (error) {
        respondWithError(ctx, error, 'failed to get guide by slug')
      }
    }
  )

  router.get(
    '/guides/:id',
    {
      summary: 'Get a guide by id',
      tags: ['Guides'],
      params: { id: uuidParam('Guide id') },
      response: {
        200: guides.GuideSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const guide = await getGuideById(ctx.params.id, db)
        if (!guide) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = guide
      } catch (error) {
        respondWithError(ctx, error, 'failed to get guide')
      }
    }
  )

  router.post(
    '/guides',
    {
      summary: 'Create a guide',
      description:
        'Creates a guide with its steps. Step bodies are sanitized to the ' +
        'allowed HTML subset. Images are added afterwards via the image ' +
        'endpoint, so any image metadata in the payload is ignored.',
      tags: ['Guides'],
      body: guides.ServiceGuideWriteSchema,
      response: {
        200: guides.GuideSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const input = sanitizeGuideWrite(
          parse(guides.ServiceGuideWriteSchema, ctx.request.body)
        )
        ctx.status = 200
        ctx.body = await createGuide(input, db)
      } catch (error) {
        respondWithError(ctx, error, 'failed to create guide')
      }
    }
  )

  router.put(
    '/guides/:id',
    {
      summary: 'Update a guide',
      description:
        'Replaces metadata and steps. Steps are upserted by id and steps ' +
        'missing from the payload are deleted with their images. Returns ' +
        'the storage keys of removed images so the caller can delete files.',
      tags: ['Guides'],
      params: { id: uuidParam('Guide id') },
      body: guides.ServiceGuideWriteSchema,
      response: {
        200: guides.UpdateGuideResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const input = sanitizeGuideWrite(
          parse(guides.ServiceGuideWriteSchema, ctx.request.body)
        )
        const result = await updateGuide(ctx.params.id, input, db)
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        respondWithError(ctx, error, 'failed to update guide')
      }
    }
  )

  router.delete(
    '/guides/:id',
    {
      summary: 'Delete a guide',
      description:
        'Deletes the guide, its steps and image rows. Returns the storage ' +
        'keys of all images so the caller can delete the files.',
      tags: ['Guides'],
      params: { id: uuidParam('Guide id') },
      response: {
        200: guides.DeleteGuideResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const result = await deleteGuide(ctx.params.id, db)
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        respondWithError(ctx, error, 'failed to delete guide')
      }
    }
  )

  router.post(
    '/guides/:id/steps/:stepId/images',
    {
      summary: 'Record an uploaded image on a step',
      description:
        'Stores image metadata after the caller has uploaded the bytes to ' +
        'file-storage. The image is appended last on the step.',
      tags: ['Guides'],
      params: {
        id: uuidParam('Guide id'),
        stepId: uuidParam('Step id'),
      },
      body: guides.CreateStepImageRequestSchema,
      response: {
        200: guides.GuideStepImageSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const input = parse(
          guides.CreateStepImageRequestSchema,
          ctx.request.body
        )
        const image = await createStepImage(
          ctx.params.id,
          ctx.params.stepId,
          input,
          db
        )
        if (!image) {
          ctx.status = 404
          ctx.body = { error: 'Step not found' }
          return
        }
        ctx.status = 200
        ctx.body = image
      } catch (error) {
        respondWithError(ctx, error, 'failed to create guide step image')
      }
    }
  )

  router.delete(
    '/guides/:id/images/:imageId',
    {
      summary: 'Delete a step image',
      tags: ['Guides'],
      params: {
        id: uuidParam('Guide id'),
        imageId: uuidParam('Image id'),
      },
      response: {
        200: guides.DeleteStepImageResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const result = await deleteStepImage(
          ctx.params.id,
          ctx.params.imageId,
          db
        )
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Image not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        respondWithError(ctx, error, 'failed to delete guide step image')
      }
    }
  )
}

// Exposed for tests that exercise category resolution without HTTP.
export { findOrCreateCategory }
