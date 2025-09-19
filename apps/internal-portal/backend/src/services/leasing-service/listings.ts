import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/listings/applicant', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = ctx.request.body
    const result =
      await coreAdapter.createNoteOfInterestForInternalParkingSpace({
        ...params,
        applicationType: params.applicationType ?? 'Additional',
      })

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
      return
    }
    ctx.status = result.statusCode
    ctx.body = { error: result.err, ...metadata }
  })

  router.delete('(.*)/listings/applicants/:applicantId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.removeApplicant(ctx.params.applicantId)

    ctx.body = { content: result, ...metadata }
  })

  router.post('(.*)/listings/:listingId/offers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = ctx.request.body
    const result = await coreAdapter.createOffer(params)

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    } else {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

  router.post('(.*)/listings/sync-internal-from-xpand', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.syncInternalParkingSpacesFromXpand()

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    } else {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

  router.delete('(.*)/listings/:listingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.deleteListing(Number(ctx.params.listingId))

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        ...metadata,
      }
      return
    } else {
      ctx.status = result.err === 'conflict' ? 409 : 500
      ctx.body = {
        ...metadata,
      }
    }
  })

  router.put('(.*)/listings/:listingId/close', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.closeListing(Number(ctx.params.listingId))

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        ...metadata,
      }
      return
    } else {
      ctx.status = 500
      ctx.body = {
        ...metadata,
      }
    }
  })

  router.put('(.*)/listings/:listingId/unpublish', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const unpublish = await coreAdapter.closeListing(
      Number(ctx.params.listingId)
    )

    if (!unpublish.ok) {
      ctx.status = 500
      ctx.body = {
        ...metadata,
      }

      logger.error('Failed to close listing', unpublish.err)
      return
    }

    const addComment = await coreAdapter.addComment(
      { targetType: 'listing', targetId: Number(ctx.params.listingId) },
      {
        authorId: ctx.session?.account.username,
        authorName: ctx.session?.account.name,
        comment: 'Bilplatsannons avpublicerad',
        type: 'COMMENT',
      }
    )

    if (!addComment.ok) {
      logger.error('Failed to add comment', addComment.err)
    }

    ctx.status = 200
    ctx.body = metadata
  })

  // /listings/with-applicants
  router.get('(.*)/listings/with-applicants', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.getListingsWithApplicants(ctx.querystring)
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: result.data,
      ...metadata,
    }
  })

  router.get('(.*)/listings/with-applicants/:listingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const response = await coreAdapter.getListingWithApplicants(
        ctx.params.listingId
      )

      ctx.status = 200
      ctx.body = { content: response, ...metadata }
    } catch (err) {
      console.log(err)
      ctx.status = 500
      ctx.body = { error: 'Internal Server Error', ...metadata }
    }
  })
}
