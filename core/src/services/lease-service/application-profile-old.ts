import KoaRouter from '@koa/router'
import dayjs from 'dayjs'
import { generateRouteMetadata } from 'onecore-utilities'
import { z } from 'zod'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import { schemas } from './schemas'

// TODO: Remove this once all routes are migrated to the new application
// profile (with housing references)
export const routes = (router: KoaRouter) => {
  router.post(
    '(.*)/contacts/:contactCode/application-profile',
    parseRequestBody(
      schemas.client.applicationProfile.UpdateApplicationProfileRequestParamsOld
    ),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      // TODO: Something wrong with parseRequestBody types.
      // Body should be inferred from middleware
      const body = ctx.request.body as z.infer<
        typeof schemas.client.applicationProfile.UpdateApplicationProfileRequestParamsOld
      >

      const getApplicationProfile =
        await leasingAdapter.getApplicationProfileByContactCode(
          ctx.params.contactCode
        )

      if (
        !getApplicationProfile.ok &&
        getApplicationProfile.err !== 'not-found'
      ) {
        ctx.status = 500
        ctx.body = { error: 'unknown', ...metadata }
        return
      }

      const expiresAt = dayjs(new Date()).add(6, 'months').toDate()
      const housingReferenceParams: leasingAdapter.CreateOrUpdateApplicationProfileRequestParams['housingReference'] =
        {
          expiresAt,
          email: body.housingReference?.email ?? null,
          phone: body.housingReference?.phone ?? null,
          comment: null,
          reasonRejected: null,
          reviewStatus: 'PENDING',
          reviewedAt: null,
          reviewedBy: null,
        }

      const createOrUpdate =
        await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
          ctx.params.contactCode,
          {
            housingTypeDescription: body.housingTypeDescription ?? null,
            expiresAt,
            housingReference: housingReferenceParams,
            lastUpdatedAt: new Date(),
            housingType: 'OTHER',
            landlord: body.landlord ?? null,
            numAdults: body.numAdults,
            numChildren: body.numChildren,
          }
        )

      if (!createOrUpdate.ok) {
        ctx.status = 500
        ctx.body = { error: 'unknown', ...metadata }
        return
      }

      ctx.status = createOrUpdate.statusCode ?? 200
      ctx.body = {
        content: createOrUpdate.data satisfies z.infer<
          typeof schemas.client.applicationProfile.UpdateApplicationProfileResponseData
        >,
        ...metadata,
      }
    }
  )
}
