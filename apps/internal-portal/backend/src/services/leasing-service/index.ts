import KoaRouter from '@koa/router'

import { generateRouteMetadata } from 'onecore-utilities'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/listings-with-applicants', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await coreAdapter.getListingsWithApplicants()
    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: 'Unknown error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: result.data,
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
    const result = await coreAdapter.getTenantByContactCode(
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

  router.get(
    '(.*)/get-and-validate-tenant/:contactCode/:districtCode/:rentalObjectCode',
    async (ctx) => {
      const getTenant = await coreAdapter.getTenantByContactCode(
        ctx.params.contactCode
      )

      if (!getTenant.ok) {
        ctx.status = 500
        return
      }

      const validate = await Promise.all([
        coreAdapter.validatePropertyRentalRules(
          ctx.params.contactCode,
          ctx.params.rentalObjectCode
        ),
        coreAdapter.validateResidentialAreaRentalRules(
          ctx.params.contactCode,
          ctx.params.districtCode
        ),
      ]).then(([validatePropertyResult, validateResidentialAreaResult]) => {
        const missingContract =
          (!validatePropertyResult.ok &&
            validatePropertyResult.err === 'no-contract-in-area-or-property') ||
          (!validateResidentialAreaResult.ok &&
            validateResidentialAreaResult.err ===
              'no-contract-in-area-or-property')

        if (missingContract) {
          return {
            ok: true,
            tenant: getTenant.data,
            validationResult: 'no-contract',
          } as const
        }

        if (!validatePropertyResult.ok || !validateResidentialAreaResult.ok) {
          return { ok: false } as const
        }

        if (validatePropertyResult.data.applicationType === 'Replace') {
          return {
            ok: true,
            tenant: getTenant.data,
            validationResult: 'needs-replace-by-property',
          } as const
        }

        if (validateResidentialAreaResult.data.applicationType === 'Replace') {
          return {
            ok: true,
            tenant: getTenant.data,
            validationResult: 'needs-replace-by-residential-area',
          } as const
        }

        if (
          getTenant.data.parkingSpaceContracts &&
          getTenant.data.parkingSpaceContracts.length > 0
        )
          return {
            ok: true,
            tenant: getTenant.data,
            validationResult: 'has-at-least-one-parking-space',
          } as const

        return {
          ok: true,
          tenant: getTenant.data,
          validationResult: 'ok',
        } as const
      })

      if (!validate.ok) {
        ctx.status = 500
        return
      }

      ctx.status = 200
      ctx.body = {
        tenant: validate.tenant,
        validationResult: validate.validationResult,
      }
    }
  )

  router.post('(.*)/listing/applicant', async (ctx) => {
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
    } else {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
    }
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
}
