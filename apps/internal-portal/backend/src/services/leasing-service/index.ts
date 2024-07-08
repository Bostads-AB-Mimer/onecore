import KoaRouter from '@koa/router'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/listings-with-applicants', async (ctx) => {
    const listings = await coreAdapter.getListingsWithApplicants()

    ctx.body = listings
  })

  router.get('(.*)/leases/listing-with-applicants/:leasingId', async (ctx) => {
    try {
      const response = await coreAdapter.getListingWithApplicants(
        ctx.params.leasingId
      )

      ctx.status = 200
      ctx.body = response
    } catch (err) {
      console.log(err)
      ctx.status = 500
    }
  })

  router.delete('(.*)/applicant/:applicantId', async (ctx) => {
    const result = await coreAdapter.removeApplicant(ctx.params.applicantId)

    ctx.body = result
  })

  router.get('(.*)/contacts/search', async (ctx) => {
    if (typeof ctx.query.q !== 'string') {
      ctx.status = 400
      return
    }

    const result = await coreAdapter.getContactsDataBySearchQuery(ctx.query.q)

    if (result.ok) {
      ctx.status = 200
      ctx.body = result.data
    } else {
      ctx.status = 500
    }
  })

  router.get('(.*)/contact/:contactCode', async (ctx) => {
    const result = await coreAdapter.getContactByContactCode(
      ctx.params.contactCode
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = result.data
    } else {
      ctx.status = 500
    }
  })

  router.post('(.*)/listing/applicant', async (ctx) => {
    const params = ctx.request.body
    const result =
      await coreAdapter.createNoteOfInterestForInternalParkingSpace(params)

    if (result.ok) {
      ctx.status = 200
      ctx.body = result.data
    } else {
      ctx.status = 500
      ctx.body = result.err
    }
  })
}
