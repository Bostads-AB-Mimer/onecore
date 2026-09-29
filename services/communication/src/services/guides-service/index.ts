import { OkapiRouter } from 'koa-okapi-router'
import { guides } from '@onecore/types'
import { z, ZodError, ZodTypeAny } from 'zod'

import { db } from '../../common/db'
import { listCategories } from './adapters/categories-adapter'
import {
  createGuide,
  deleteGuide,
  getGuideById,
  getGuideBySlug,
  listGuides,
  updateGuide,
} from './adapters/guides-adapter'
import { createStepImage, deleteStepImage } from './adapters/images-adapter'
import {
  AltTextRequiredError,
  CategoryNotFoundError,
  GuideModifiedError,
  ImageNotInStepError,
  SlugTakenError,
  StepBelongsToOtherGuideError,
} from './errors'
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

// Single definition of the uuid shape, shared by the swagger-doc parameters
// and the runtime param schemas so the two cannot drift apart.
const UuidSchema = z.string().uuid()

const uuidParam = (description: string) => ({
  description,
  schema: UuidSchema,
})

// The okapi router only types and documents the schemas; it does not
// validate at runtime, so every handler parses its own input.
class RequestValidationError extends Error {
  constructor(public readonly zodError: ZodError) {
    super('Request validation failed')
    this.name = 'RequestValidationError'
  }
}

// A path parameter that does not match its schema cannot name an existing
// resource, so it is answered with 404 rather than 400.
class ParamValidationError extends Error {
  constructor() {
    super('Path parameter validation failed')
    this.name = 'ParamValidationError'
  }
}

// Bodies are parsed here instead of with the parseRequestBody middleware:
// OkapiRouter routes take exactly one middleware (no chaining), and
// parseRequestBody answers 400 with { status, data } while core relays this
// service's { error: 'Validation failed', issues } body to its callers.
const parse = <S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> => {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) throw new RequestValidationError(error)
    throw error
  }
}

const parseParams = <S extends ZodTypeAny>(
  schema: S,
  value: unknown
): z.infer<S> => {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) throw new ParamValidationError()
    throw error
  }
}

const GuideParamsSchema = z.object({ id: UuidSchema })
const SlugParamsSchema = z.object({ slug: guides.SlugSchema })
const StepImageParamsSchema = z.object({
  id: UuidSchema,
  stepId: UuidSchema,
})
const ImageParamsSchema = z.object({
  id: UuidSchema,
  imageId: UuidSchema,
})

type ErrorContext = {
  status: number
  body: unknown
}

// Shared error mapping so every route answers the same way. Unexpected errors
// are not logged here: they come from the adapters, which already log them
// with their own context (services/CLAUDE.md), so logging again would record
// every 500 twice.
const respondWithError = (ctx: ErrorContext, error: unknown) => {
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
  if (error instanceof ParamValidationError) {
    ctx.status = 404
    ctx.body = { error: 'not-found' }
    return
  }
  if (error instanceof SlugTakenError) {
    ctx.status = 409
    ctx.body = { error: 'slug-taken' }
    return
  }
  if (error instanceof GuideModifiedError) {
    ctx.status = 409
    ctx.body = { error: 'guide-modified' }
    return
  }
  if (error instanceof CategoryNotFoundError) {
    ctx.status = 400
    ctx.body = { error: 'category-not-found' }
    return
  }
  if (error instanceof ImageNotInStepError) {
    ctx.status = 400
    ctx.body = { error: 'image-not-in-step' }
    return
  }
  if (error instanceof AltTextRequiredError) {
    ctx.status = 400
    ctx.body = { error: 'alt-text-required' }
    return
  }
  if (error instanceof StepBelongsToOtherGuideError) {
    ctx.status = 400
    ctx.body = { error: 'step-belongs-to-other-guide' }
    return
  }
  ctx.status = 500
  // Never expose the underlying error (SQL text, connection details).
  ctx.body = { error: 'internal-server-error' }
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
        respondWithError(ctx, error)
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
        respondWithError(ctx, error)
      }
    }
  )

  router.get(
    '/guides/by-slug/:slug',
    {
      summary: 'Get a guide by slug',
      description:
        'Resolves the current slug only; a slug a guide had before a rename ' +
        'gives 404. Drafts are returned; the caller decides who may see them.',
      tags: ['Guides'],
      params: {
        slug: {
          description: 'Current slug',
          schema: guides.SlugSchema,
        },
      },
      response: {
        200: guides.GuideSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const params = parseParams(SlugParamsSchema, ctx.params)
        const guide = await getGuideBySlug(params.slug, db)
        if (!guide) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = guide
      } catch (error) {
        respondWithError(ctx, error)
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
        const params = parseParams(GuideParamsSchema, ctx.params)
        const guide = await getGuideById(params.id, db)
        if (!guide) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = guide
      } catch (error) {
        respondWithError(ctx, error)
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
        'endpoint, so any image metadata in the payload is ignored. ' +
        'Errors: 409 slug-taken, 400 category-not-found, 400 ' +
        'step-belongs-to-other-guide when a step id is already used by ' +
        'another guide.',
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
        respondWithError(ctx, error)
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
        'the storage keys of removed images so the caller can delete files. ' +
        'expectedUpdatedAt must equal the stored updatedAt (millisecond ' +
        'precision); image uploads and deletes also move it forward. ' +
        'Errors: 409 guide-modified when expectedUpdatedAt is stale (the ' +
        'guide changed since the caller loaded it), 409 slug-taken, 400 ' +
        'category-not-found, 400 ' +
        'step-belongs-to-other-guide when a step id is owned by another ' +
        'guide, and 400 image-not-in-step when an image id is unknown or ' +
        'sent on a step it does not belong to (images cannot be moved ' +
        'between steps by a save).',
      tags: ['Guides'],
      params: { id: uuidParam('Guide id') },
      body: guides.ServiceGuideUpdateSchema,
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
        const params = parseParams(GuideParamsSchema, ctx.params)
        const input = sanitizeGuideWrite(
          parse(guides.ServiceGuideUpdateSchema, ctx.request.body)
        )
        const result = await updateGuide(params.id, input, db)
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        respondWithError(ctx, error)
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
        const params = parseParams(GuideParamsSchema, ctx.params)
        const result = await deleteGuide(params.id, db)
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Guide not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        respondWithError(ctx, error)
      }
    }
  )

  router.post(
    '/guides/:id/steps/:stepId/images',
    {
      summary: 'Record an uploaded image on a step',
      description:
        'Stores image metadata after the caller has uploaded the bytes to ' +
        'file-storage. The image is appended last on the step. Bumps the ' +
        "guide's updatedAt and returns the new value as guideUpdatedAt. " +
        'Errors: 400 alt-text-required when the guide is published and ' +
        'altText is missing or blank.',
      tags: ['Guides'],
      params: {
        id: uuidParam('Guide id'),
        stepId: uuidParam('Step id'),
      },
      body: guides.CreateStepImageRequestSchema,
      response: {
        200: guides.CreateStepImageResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    async (ctx) => {
      try {
        const params = parseParams(StepImageParamsSchema, ctx.params)
        const input = parse(
          guides.CreateStepImageRequestSchema,
          ctx.request.body
        )
        const result = await createStepImage(
          params.id,
          params.stepId,
          input,
          db
        )
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Step not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        respondWithError(ctx, error)
      }
    }
  )

  router.delete(
    '/guides/:id/images/:imageId',
    {
      summary: 'Delete a step image',
      description:
        "Removes the image row, bumps the guide's updatedAt and returns the " +
        'storage key and the new updatedAt as guideUpdatedAt.',
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
        const params = parseParams(ImageParamsSchema, ctx.params)
        const result = await deleteStepImage(params.id, params.imageId, db)
        if (!result) {
          ctx.status = 404
          ctx.body = { error: 'Image not found' }
          return
        }
        ctx.status = 200
        ctx.body = result
      } catch (error) {
        respondWithError(ctx, error)
      }
    }
  )
}
