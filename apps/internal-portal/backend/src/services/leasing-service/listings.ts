import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/listings', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = ctx.request.body
    const result = await coreAdapter.createListings(params)

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

  router.post('(.*)/listings/batch', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = ctx.request.body
    const result = await coreAdapter.createMultipleListings(params.listings)

    if (result.ok) {
      ctx.status = 201
      ctx.body = {
        content: result.data,
        message: `Successfully created ${result.data.length} listings`,
        ...metadata,
      }
    } else if (result.err === 'partial-failure') {
      ctx.status = 207
      ctx.body = {
        error: 'Some listings could not be created',
        message:
          'Partial success - some listings were created successfully while others failed',
        ...metadata,
      }
    } else {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

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

  router.post('(.*)/listings/non-scored-lease', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = ctx.request.body

    const result = await coreAdapter.createLeaseForNonScoredParkingSpace({
      parkingSpaceId: params.parkingSpaceId,
      contactCode: params.contactCode,
      startDate: params.startDate,
    })

    if (result.ok) {
      // Add comment to nonscored listing indicating credit check type and approval
      const creditCheckType = (result.data as any)?.creditCheckType
      const creditCheckDescription =
        creditCheckType === 'intern'
          ? 'Intern betalningskontroll'
          : 'Kreditkontroll'
      const commentText = `Anmälan hanterad av ${ctx.session?.account.name}. Tilldelad till ${params.contactCode}. ${creditCheckDescription} godkänd.`

      const addCommentResult = await coreAdapter.addComment(
        { targetType: 'listing', targetId: Number(params.listingId) },
        {
          authorId: 'system',
          authorName: 'System',
          comment: `Automatisk notering ${commentText}`,
          type: 'COMMENT',
        }
      )

      if (!addCommentResult.ok) {
        logger.error(
          { error: addCommentResult.err },
          'Failed to add comment to parking space listing'
        )
      }

      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
      return
    }

    ctx.status = result.statusCode
    ctx.body = {
      error: result.err,
      errorMessage: result.err,
      ...metadata,
    }
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

  router.put('(.*)/listings/:listingId/unpublish', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const unpublish = await coreAdapter.expireListing(
      Number(ctx.params.listingId)
    )

    if (!unpublish.ok) {
      ctx.status = 500
      ctx.body = {
        ...metadata,
      }

      logger.error({ error: unpublish.err }, 'Failed to unpublish listing')
      return
    }

    const addComment = await coreAdapter.addComment(
      { targetType: 'listing', targetId: Number(ctx.params.listingId) },
      {
        authorId: ctx.session?.account.username,
        authorName: ctx.session?.account.name,
        comment: 'Bilplatsannons manuellt avpublicerad.',
        type: 'COMMENT',
      }
    )

    if (!addComment.ok) {
      logger.error({ error: addComment.err }, 'Failed to add comment')
    }

    ctx.status = 200
    ctx.body = metadata
  })

  router.put('(.*)/listings/:listingId/close', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const close = await coreAdapter.closeListing(Number(ctx.params.listingId))

    if (!close.ok) {
      ctx.status = 500
      ctx.body = {
        ...metadata,
      }

      logger.error({ error: close.err }, 'Failed to close listing')
      return
    }

    const addComment = await coreAdapter.addComment(
      { targetType: 'listing', targetId: Number(ctx.params.listingId) },
      {
        authorId: ctx.session?.account.username,
        authorName: ctx.session?.account.name,
        comment: 'Bilplatsannonsering avslutad',
        type: 'COMMENT',
      }
    )

    if (!addComment.ok) {
      logger.error({ error: addComment.err }, 'Failed to add comment')
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
