import KoaRouter from '@koa/router'
import { OfferStatus } from 'onecore-types'
import { logger } from 'onecore-utilities'
import { z } from 'zod'

import * as offerAdapter from './../adapters/offer-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

export const routes = (router: KoaRouter) => {
  const createOfferRequestParams = z.object({
    expiresAt: z.coerce.date(),
    status: z.nativeEnum(OfferStatus),
    selectedApplicants: z.any().array(),
    listingId: z.coerce.number(),
    applicantId: z.number(),
  })

  router.post(
    '(.*)/offer',
    parseRequestBody(createOfferRequestParams),
    async (ctx) => {
      try {
        const offer = await offerAdapter.create(ctx.request.body)

        ctx.status = 201
        ctx.body = { data: offer }
      } catch (err) {
        logger.error(err, 'Error creating offer: ')
        ctx.status = 500
      }
    }
  )
}
