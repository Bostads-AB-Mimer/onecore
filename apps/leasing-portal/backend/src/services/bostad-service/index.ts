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
}
