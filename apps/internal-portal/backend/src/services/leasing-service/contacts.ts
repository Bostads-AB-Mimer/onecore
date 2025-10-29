import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { LeaseStatus, RouteErrorResponse } from '@onecore/types'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/contacts', async (ctx) => {
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

  router.get('(.*)/contacts/:contactCode', async (ctx) => {
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

  router.get('(.*)/contacts/:contactCode/application-profile', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q'])

    const [applicationProfileResult, contactResult] = await Promise.all([
      coreAdapter.getApplicationProfileByContactCode(ctx.params.contactCode),
      coreAdapter.getContactByContactCode(ctx.params.contactCode),
    ])

    let applicationProfile = null

    // FIXME: Should status 404 not be allowed to be "ok" ?
    if (!applicationProfileResult.ok) {
      if (applicationProfileResult.statusCode != 404) {
        ctx.status = applicationProfileResult.statusCode
        ctx.body = { error: applicationProfileResult.err, ...metadata }
        return
      }
    } else {
      applicationProfile = applicationProfileResult.data
    }

    if (!contactResult.ok) {
      ctx.status = contactResult.statusCode
      ctx.body = { error: contactResult.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: {
        applicationProfile,
        contact: contactResult.data,
      },
      ...metadata,
    }
  })

  router.put('(.*)/contacts/:contactCode/application-profile', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q'])

    const result = await coreAdapter.createOrUpdateApplicationProfile(
      ctx.params.contactCode,
      {
        ...ctx.request.body,
        housingReference: {
          ...ctx.request.body.housingReference,
          reviewedBy: ctx.session?.account.name,
        },
      }
    )

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

  router.get(
    '(.*)/contacts/:contactCode/validate-tentant/:districtCode/:rentalObjectCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const getTenant = await coreAdapter.getTenantByContactCode(
        ctx.params.contactCode
      )
      if (!getTenant.ok && getTenant.err === 'no-valid-housing-contract') {
        ctx.status = 403
        ctx.body = {
          type: 'no-valid-housing-contract',
          title: 'No valid housing contract found',
          status: 403,
          detail: 'No active or upcoming contract found.',
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      if (!getTenant.ok && getTenant.err === 'contact-not-tenant') {
        ctx.status = 403
        ctx.body = {
          type: getTenant.err,
          title: 'Contact is not a tenant',
          status: 403,
          detail: 'No active or upcoming contract found.',
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

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
          getTenant.data.parkingSpaceContracts.filter(
            (l) =>
              l.status == LeaseStatus.Current ||
              l.status == LeaseStatus.Upcoming
          ).length > 0
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
        ctx.status = 403
        return
      }

      ctx.status = 200
      ctx.body = {
        tenant: validate.tenant,
        validationResult: validate.validationResult,
      }
    }
  )

  router.get('(.*)/contacts/:contactCode/contact-card', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const getContact = await coreAdapter.getContactByContactCode(
      ctx.params.contactCode
    )

    if (!getContact.ok) {
      ctx.status = getContact.statusCode
      return
    }

    const getInvoices = await coreAdapter.getInvoicesByContactCode(
      ctx.params.contactCode
    )

    if (!getInvoices.ok) {
      ctx.status = getInvoices.statusCode
      return
    }

    const getLeases = await coreAdapter.getLeasesByContactCode(
      ctx.params.contactCode
    )

    if (!getLeases.ok) {
      ctx.status = getLeases.statusCode ?? 500
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(
      {
        ...getContact.data,
        invoices: getInvoices.data,
        leases: getLeases.data,
      },
      metadata
    )
  })

  router.get('(.*)/contacts/by-pnr/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const getContact = await coreAdapter.getContactByNationalRegistrationNumber(
      ctx.params.pnr
    )

    if (!getContact.ok) {
      ctx.status = getContact.statusCode
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(getContact.data, metadata)
  })
}
