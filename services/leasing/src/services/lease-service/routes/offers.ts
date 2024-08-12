import KoaRouter from '@koa/router'
import { OfferStatus } from 'onecore-types'
import { logger } from 'onecore-utilities'
import { z } from 'zod'

import * as offerAdapter from './../adapters/offer-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { getOffersForContact } from './../adapters/offer-adapter'
import { HttpStatusCode } from 'axios'

/**
 * @swagger
 * tags:
 *   - name: Offer
 *     description: Endpoints related to offer operations
 */
export const routes = (router: KoaRouter) => {
  const createOfferRequestParams = z.object({
    expiresAt: z.coerce.date(),
    status: z.nativeEnum(OfferStatus),
    selectedApplicants: z.any().array(),
    listingId: z.coerce.number(),
    applicantId: z.number(),
  })

  /**
   * @swagger
   * /offer:
   *   post:
   *     summary: Create new offer for listing
   *     description: Create a new offer
   *     tags: [Offer]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *                 description: The expiration date of the offer
   *               status:
   *                 type: string
   *                 enum: OfferStatus
   *                 description: The status of the offer
   *               selectedApplicants:
   *                 type: array
   *                 items:
   *                   type: object
   *                 description: The selected applicants
   *               listingId:
   *                 type: number
   *                 description: The ID of the listing
   *               applicantId:
   *                 type: number
   *                 description: The ID of the applicant
   *     responses:
   *       201:
   *         description: Offer created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The created offer
   *       500:
   *         description: Internal server error
   */
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

  //todo: add swagger docs
  router.get('/contacts/:contactCode/offers', async (ctx) => {
    const responseData = await getOffersForContact(ctx.params.contactCode)
    if (!responseData.length) {
      ctx.status = HttpStatusCode.NotFound
      return
    }
    ctx.body = {
      data: responseData,
    }
  })
}
