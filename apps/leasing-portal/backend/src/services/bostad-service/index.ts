import { OkapiRouter } from 'koa-okapi-router'
import { leasing } from '@onecore/types'
import z from 'zod'

import { AppModules } from '@src/context'
import { getAccessToken } from '@src/middlewares/require-user-token'
import { forwardCoreError } from '@src/services/common/forward-core-error'
import { CoreErrorResponseBodySchema } from '@src/services/auth-service/schema'

const VacantApartmentsResponseSchema = z.object({
  content: z.array(leasing.VacantApartmentSchema),
})

const UpdateListingResponseSchema = z.object({
  content: leasing.ListingSchema,
})

const CreateListingRequestSchema = z.object({
  rentalObjectCode: z.string(),
})

/** Pure passthrough to core's /vacant-apartments: this layer adds auth and a
 * typed spec for the frontend, nothing else. */
export const routes = (router: OkapiRouter, { coreClient }: AppModules) => {
  router.get(
    '/bostad/vacant-apartments',
    {
      summary: 'Apartments ready to be published',
      description:
        'Vacant or soon-vacant apartments without an indefinite rental block that are not ' +
        'already published or further along in the letting process. Passthrough to core.',
      tags: ['Bostad'],
      response: {
        200: VacantApartmentsResponseSchema,
        401: CoreErrorResponseBodySchema,
        502: CoreErrorResponseBodySchema, // core 5xx, body kept; or unexpected-core-response
      },
    },
    async (ctx) => {
      const result = await coreClient.request(getAccessToken(ctx), {
        method: 'get',
        path: '/vacant-apartments',
      })

      if (!result.ok) {
        return forwardCoreError(ctx, result)
      }

      const parsed = VacantApartmentsResponseSchema.safeParse(result.data)
      if (!parsed.success) {
        ctx.status = 502
        ctx.body = { error: 'unexpected-core-response' }
        return
      }

      ctx.status = 200
      ctx.body = { content: parsed.data.content }
    }
  )

  /** Passthrough to core's POST /listings: creates a draft listing for an
   * apartment that doesn't have one yet, so "Redigera annons" always has
   * something to open. */
  router.post(
    '/bostad/listings',
    {
      summary: 'Create a draft listing for an apartment',
      description:
        'Creates a Draft listing for a rental object that has none yet. Passthrough to core.',
      tags: ['Bostad'],
      body: CreateListingRequestSchema,
      response: {
        201: UpdateListingResponseSchema,
        400: z.object({ error: z.string() }),
        401: CoreErrorResponseBodySchema,
        409: CoreErrorResponseBodySchema,
        502: CoreErrorResponseBodySchema,
      },
    },
    async (ctx) => {
      const parsedBody = CreateListingRequestSchema.safeParse(ctx.request.body)
      if (!parsedBody.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid-request-body' }
        return
      }

      const result = await coreClient.request(getAccessToken(ctx), {
        method: 'post',
        path: '/listings',
        data: { ...parsedBody.data, listingCategory: 'APARTMENT' },
      })

      if (!result.ok) {
        return forwardCoreError(ctx, result)
      }

      const parsed = UpdateListingResponseSchema.safeParse(result.data)
      if (!parsed.success) {
        ctx.status = 502
        ctx.body = { error: 'unexpected-core-response' }
        return
      }

      ctx.status = 201
      ctx.body = { content: parsed.data.content }
    }
  )

  /** Passthrough to core's PATCH /listings/:id for the "Redigera Annons"
   * dialog's publish/review fields. */
  router.patch(
    '/bostad/listings/:listingId',
    {
      summary: 'Update a listing',
      description:
        'Partially updates publishedFrom, publishedTo, reviewedAt, ' +
        'reviewedBy, availableFrom and tentativeAvailableFrom on a ' +
        'listing. Passthrough to core.',
      tags: ['Bostad'],
      params: {
        listingId: {
          description: 'The listing id',
          schema: z.coerce.number(),
        },
      },
      body: leasing.UpdateListingSchema,
      response: {
        200: UpdateListingResponseSchema,
        400: z.object({ error: z.string() }),
        401: CoreErrorResponseBodySchema,
        404: CoreErrorResponseBodySchema,
        502: CoreErrorResponseBodySchema,
      },
    },
    async (ctx) => {
      const parsedBody = leasing.UpdateListingSchema.safeParse(ctx.request.body)
      if (!parsedBody.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid-request-body' }
        return
      }

      const result = await coreClient.request(getAccessToken(ctx), {
        method: 'patch',
        path: `/listings/${ctx.params.listingId}`,
        data: parsedBody.data,
      })

      if (!result.ok) {
        return forwardCoreError(ctx, result)
      }

      const parsed = UpdateListingResponseSchema.safeParse(result.data)
      if (!parsed.success) {
        ctx.status = 502
        ctx.body = { error: 'unexpected-core-response' }
        return
      }

      ctx.status = 200
      ctx.body = { content: parsed.data.content }
    }
  )
}
