import KoaRouter from '@koa/router'
import { OfferStatus } from 'onecore-types'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { HttpStatusCode } from 'axios'
import { z } from 'zod'

import * as offerAdapter from './../adapters/offer-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import * as offerService from '../offer-service'

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
      const metadata = generateRouteMetadata(ctx)
      try {
        const offer = await offerAdapter.create(ctx.request.body)

        ctx.status = 201
        ctx.body = { content: offer, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating offer: ')
        ctx.status = 500
        ctx.body = { error: 'Error creating offer', ...metadata }
      }
    }
  )

  router.get('(.*)/offers/:offerId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const res = await offerAdapter.getOfferByOfferId(
        parseInt(ctx.params.offerId)
      )
      if (!res.ok) {
        ctx.status = HttpStatusCode.NotFound
        ctx.body = { error: 'Offer not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: res.data, ...metadata }
    } catch (err) {
      logger.error(err, 'Error getting offer: ')
      ctx.status = 500
      ctx.body = { error: 'Error getting offer', ...metadata }
    }
  })

  //todo: rewrite url to offers/applicant/:contactCode
  /**
   * @swagger
   * /contacts/{contactCode}/offers:
   *   get:
   *     summary: Get offers for a specific contact
   *     description: Retrieve a list of offers associated with a specific contact using the contact's code.
   *     tags: [Offer]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique code identifying the contact.
   *     responses:
   *       200:
   *         description: A list of offers for the specified contact.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: No offers found for the specified contact code.
   */

  router.get('/contacts/:contactCode/offers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await offerAdapter.getOffersForContact(
      ctx.params.contactCode
    )
    if (!responseData.length) {
      ctx.status = HttpStatusCode.NotFound
      ctx.body = { error: 'No offers found', ...metadata }
      return
    }
    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /offers/{offerId}/applicants/{contactCode}:
   *   get:
   *     summary: Get a specific offer for an applicant
   *     description: Retrieve details of a specific offer associated with an applicant using contact code and offer ID.
   *     tags: [Offer]
   *     parameters:
   *       - in: path
   *         name: offerId
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the offer.
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique code identifying the applicant.
   *     responses:
   *       200:
   *         description: Details of the specified offer.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Offer not found for the specified contact code and offer ID.
   */

  router.get('/offers/:offerId/applicants/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await offerAdapter.getOfferByContactCodeAndOfferId(
      ctx.params.contactCode,
      parseInt(ctx.params.offerId)
    )

    if (!responseData) {
      ctx.status = HttpStatusCode.NotFound
      ctx.body = { error: 'Offer not found', ...metadata }
      return
    }
    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /offers/{offerId}/close-by-accept:
   *   put:
   *     summary: Closes offer and updates applicant and listing statuses
   *     description:
   *       When offer is accepted, this route closes the offer and
   *       updates applicant and listing status to the correct values.
   *     tags: [Offer]
   *     parameters:
   *       - in: path
   *         name: offerId
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the offer.
   *     responses:
   *       200:
   *         description: Details of the specified offer.
   *       404:
   *         description: Offer not found for the specified offer ID.
   */

  router.put('/offers/:offerId/close-by-accept', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const offer = await offerAdapter.getOfferByOfferId(
      Number(ctx.params.offerId)
    )

    if (!offer.ok) {
      if (offer.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Offer not found', ...metadata }
        return
      } else {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }

    const result = await offerService.acceptOffer({
      listingId: offer.data.listingId,
      applicantId: offer.data.offeredApplicant.id,
      offerId: offer.data.id,
    })

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
    return
  })

  /**
   * @swagger
   * /offers/{offerId}/deny:
   *   put:
   *     summary: Denies an offer and updates applicant and offer statuses
   *     description: Denies an offer by its offer ID and updates the applicant and offer.
   *     tags: [Offer]
   *     parameters:
   *       - in: path
   *         name: offerId
   *         required: true
   *         schema:
   *           type: integer
   *         description: The unique ID of the offer to be denied.
   *     responses:
   *       200:
   *         description: Offer successfully denied.
   *       404:
   *         description: Offer not found for the specified offer ID.
   *       500:
   *         description: Internal server error.
   */
  router.put('/offers/:offerId/deny', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const offer = await offerAdapter.getOfferByOfferId(
      Number(ctx.params.offerId)
    )

    if (!offer.ok) {
      if (offer.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Offer not found', ...metadata }
        return
      } else {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }

    const result = await offerService.denyOffer({
      applicantId: offer.data.offeredApplicant.id,
      offerId: offer.data.id,
    })

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
    return
  })
}
