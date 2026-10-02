import { OkapiRouter } from 'koa-okapi-router'
import { KeycloakUserSchema } from '@onecore/types'
import { AppModules } from '@src/context'
import { getAccessToken } from '@src/middlewares/require-user-token'
import { forwardCoreError } from '@src/services/common/forward-core-error'
import { CoreErrorResponseBodySchema, ErrorResponseBodySchema } from './schema'

export const routes = (router: OkapiRouter, { coreClient }: AppModules) => {
  router.get(
    '/auth/profile',
    {
      summary: 'Get the logged-in user',
      description:
        'Forwards the caller token to core and returns the profile core resolves for it. ' +
        'A 401 means the token is missing or expired: refresh via core /auth/refresh and retry.',
      tags: ['Auth'],
      response: {
        200: KeycloakUserSchema,
        401: CoreErrorResponseBodySchema,
        502: ErrorResponseBodySchema,
      },
    },
    async (ctx) => {
      const result = await coreClient.request(getAccessToken(ctx), {
        method: 'get',
        path: '/auth/profile',
      })

      if (!result.ok) {
        return forwardCoreError(ctx, result)
      }

      const profile = KeycloakUserSchema.safeParse(result.data)
      if (!profile.success) {
        ctx.status = 502
        ctx.body = { error: 'unexpected-core-response' }
        return
      }

      ctx.status = 200
      ctx.body = profile.data
    }
  )
}
