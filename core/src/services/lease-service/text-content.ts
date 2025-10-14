/*
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { leasing } from '@onecore/types'
import { z } from 'zod'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import { registerSchema } from '../../utils/openapi'

/**
 * @swagger
 * tags:
 *   - name: ListingTextContent
 *     description: Endpoints related to operations regarding listing text content.
 */
export const routes = (router: KoaRouter) => {
  registerSchema('ListingTextContent', leasing.v1.ListingTextContentSchema)

  /**
   * @swagger
   * /listing-text-content/{rentalObjectCode}:
   *   get:
   *     summary: Get listing text content by rental object code
   *     description: |
   *       Fetch the listing text content for a specific rental object.
   *     tags: [ListingTextContent]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The rental object code to fetch text content for.
   *     responses:
   *       200:
   *         description: Listing text content object
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ListingTextContent'
   *       404:
   *         description: Listing text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    try {
      const result = await leasingAdapter.getListingTextContentByRentalObjectCode(
        rentalObjectCode
      )

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: 'Listing text content not found', ...metadata }
          return
        }

        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching listing text content from leasing')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /listing-text-content:
   *   post:
   *     summary: Create listing text content
   *     description: |
   *       Create new listing text content for a rental object.
   *     tags: [ListingTextContent]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateListingTextContentRequest'
   *     responses:
   *       201:
   *         description: Listing text content created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ListingTextContent'
   *       400:
   *         description: Invalid request body
   *       409:
   *         description: Listing text content already exists for rental object code
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/listing-text-content',
    parseRequestBody(leasing.v1.CreateListingTextContentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      // TODO: Something wrong with parseRequestBody types.
      // Body should be inferred from middleware
      const body = ctx.request.body as z.infer<
        typeof leasing.v1.CreateListingTextContentRequestSchema
      >

      try {
        const result = await leasingAdapter.createListingTextContent(body)

        if (!result.ok) {
          if (result.err === 'conflict') {
            ctx.status = 409
            ctx.body = {
              reason: 'Listing text content already exists for rental object code',
              ...metadata,
            }
            return
          }

          ctx.status = 500
          ctx.body = { error: 'Failed to create listing text content', ...metadata }
          return
        }

        ctx.status = 201
        ctx.body = { content: result.data, ...metadata }
      } catch (err) {
        logger.error({ err, metadata }, 'Error creating listing text content in leasing')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /listing-text-content/{rentalObjectCode}:
   *   put:
   *     summary: Update listing text content
   *     description: |
   *       Update existing listing text content.
   *     tags: [ListingTextContent]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The rental object code of the listing text content to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateListingTextContentRequest'
   *     responses:
   *       200:
   *         description: Listing text content updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ListingTextContent'
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: Listing text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '/listing-text-content/:rentalObjectCode',
    parseRequestBody(leasing.v1.UpdateListingTextContentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { rentalObjectCode } = ctx.params
      // TODO: Something wrong with parseRequestBody types.
      // Body should be inferred from middleware
      const body = ctx.request.body as z.infer<
        typeof leasing.v1.UpdateListingTextContentRequestSchema
      >

      try {
        const result = await leasingAdapter.updateListingTextContent(
          rentalObjectCode,
          body
        )

        if (!result.ok) {
          if (result.err === 'not-found') {
            ctx.status = 404
            ctx.body = { reason: 'Listing text content not found', ...metadata }
            return
          }

          ctx.status = 500
          ctx.body = { error: 'Failed to update listing text content', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = { content: result.data, ...metadata }
      } catch (err) {
        logger.error({ err, metadata }, 'Error updating listing text content in leasing')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /listing-text-content/{rentalObjectCode}:
   *   delete:
   *     summary: Delete listing text content
   *     description: |
   *       Delete listing text content.
   *     tags: [ListingTextContent]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The rental object code of the listing text content to delete.
   *     responses:
   *       200:
   *         description: Listing text content deleted successfully
   *       404:
   *         description: Listing text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    try {
      const result = await leasingAdapter.deleteListingTextContent(rentalObjectCode)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: 'Listing text content not found', ...metadata }
          return
        }

        ctx.status = 500
        ctx.body = { error: 'Failed to delete listing text content', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: null, ...metadata }
    } catch (err) {
      logger.error({ err, metadata }, 'Error deleting listing text content in leasing')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}