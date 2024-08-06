import KoaRouter from '@koa/router'

import { generateRouteMetadata } from 'onecore-utilities'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/listings-with-applicants', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const listings = await coreAdapter.getListingsWithApplicants()

    ctx.body = {
      content: listings,
      ...metadata,
    }
  })

  router.get('(.*)/leases/listing-with-applicants/:leasingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const response = await coreAdapter.getListingWithApplicants(
        ctx.params.leasingId
      )

      ctx.status = 200
      ctx.body = { content: response, ...metadata }
    } catch (err) {
      console.log(err)
      ctx.status = 500
      ctx.body = { error: 'Internal Server Error', ...metadata }
    }
  })

  router.delete('(.*)/applicant/:applicantId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.removeApplicant(ctx.params.applicantId)

    ctx.body = { content: result, ...metadata }
  })

  router.get('(.*)/contacts/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q'])
    if (typeof ctx.query.q !== 'string') {
      ctx.status = 400
      ctx.body = { reason: 'Invalid query parameter', ...metadata }
      return
    }

    const result = await coreAdapter.getContactsDataBySearchQuery(ctx.query.q)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = 500
      ctx.body = { error: 'Internal Server Error', ...metadata }
    }
  })

  router.get('(.*)/contact/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.getContactByContactCode(
      ctx.params.contactCode
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = 500
      ctx.body = { error: 'Internal Server Error', ...metadata }
    }
  })

  router.post('(.*)/listing/applicant', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = ctx.request.body
    const result =
      await coreAdapter.createNoteOfInterestForInternalParkingSpace(params)

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
}
