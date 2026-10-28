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
 *   - name: ListingAreaTextContent
 *     description: Endpoints related to operations regarding listing market-area text content.
 */
export const routes = (router: KoaRouter) => {
  registerSchema(
    'ListingAreaTextContent',
    leasing.v1.ListingAreaTextContentSchema
  )
  registerSchema(
    'CreateListingAreaTextContentRequest',
    leasing.v1.CreateListingAreaTextContentRequestSchema
  )
  registerSchema(
    'UpdateListingAreaTextContentRequest',
    leasing.v1.UpdateListingAreaTextContentRequestSchema
  )

  /**
   * @swagger
   * /listing-area-text-content:
   *   get:
   *     summary: List listing area text content
   *     description: |
   *       Fetch the listing text content for all market areas.
   *     tags: [ListingAreaTextContent]
   *     responses:
   *       200:
   *         description: List of listing area text content objects
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ListingAreaTextContent'
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/listing-area-text-content', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await leasingAdapter.listListingAreaTextContent()

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (err) {
      logger.error(
        { err, metadata },
        'Error fetching listing area text content list from leasing'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /listing-area-text-content/{marketAreaCode}:
   *   get:
   *     summary: Get listing area text content by market area code
   *     description: |
   *       Fetch the listing text content for a specific market area.
   *     tags: [ListingAreaTextContent]
   *     parameters:
   *       - in: path
   *         name: marketAreaCode
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The market area code to fetch text content for.
   *     responses:
   *       200:
   *         description: Listing area text content object
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ListingAreaTextContent'
   *       404:
   *         description: Listing area text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/listing-area-text-content/:marketAreaCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { marketAreaCode } = ctx.params

    try {
      const result =
        await leasingAdapter.getListingAreaTextContentByMarketAreaCode(
          marketAreaCode
        )

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            reason: 'Listing area text content not found',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (err) {
      logger.error(
        { err, metadata },
        'Error fetching listing area text content from leasing'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /listing-area-text-content:
   *   post:
   *     summary: Create listing area text content
   *     description: |
   *       Create new listing text content for a market area.
   *     tags: [ListingAreaTextContent]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateListingAreaTextContentRequest'
   *     responses:
   *       201:
   *         description: Listing area text content created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ListingAreaTextContent'
   *       400:
   *         description: Invalid request body
   *       409:
   *         description: Listing area text content already exists for market area code
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/listing-area-text-content',
    parseRequestBody(leasing.v1.CreateListingAreaTextContentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      // parseRequestBody does not narrow ctx.request.body; cast like text-content.ts does
      const body = ctx.request.body as z.infer<
        typeof leasing.v1.CreateListingAreaTextContentRequestSchema
      >

      try {
        const result = await leasingAdapter.createListingAreaTextContent(body)

        if (!result.ok) {
          if (result.err === 'bad-request') {
            ctx.status = 400
            ctx.body = { error: 'Invalid request body', ...metadata }
            return
          }

          if (result.err === 'conflict') {
            ctx.status = 409
            ctx.body = {
              reason:
                'Listing area text content already exists for market area code',
              ...metadata,
            }
            return
          }

          ctx.status = 500
          ctx.body = {
            error: 'Failed to create listing area text content',
            ...metadata,
          }
          return
        }

        ctx.status = 201
        ctx.body = { content: result.data, ...metadata }
      } catch (err) {
        logger.error(
          { err, metadata },
          'Error creating listing area text content in leasing'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /listing-area-text-content/{marketAreaCode}:
   *   put:
   *     summary: Update listing area text content
   *     description: |
   *       Update existing listing text content for a market area.
   *     tags: [ListingAreaTextContent]
   *     parameters:
   *       - in: path
   *         name: marketAreaCode
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The market area code of the listing text content to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateListingAreaTextContentRequest'
   *     responses:
   *       200:
   *         description: Listing area text content updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ListingAreaTextContent'
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: Listing area text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '/listing-area-text-content/:marketAreaCode',
    parseRequestBody(leasing.v1.UpdateListingAreaTextContentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { marketAreaCode } = ctx.params
      // parseRequestBody does not narrow ctx.request.body; cast like text-content.ts does
      const body = ctx.request.body as z.infer<
        typeof leasing.v1.UpdateListingAreaTextContentRequestSchema
      >

      try {
        const result = await leasingAdapter.updateListingAreaTextContent(
          marketAreaCode,
          body
        )

        if (!result.ok) {
          if (result.err === 'bad-request') {
            ctx.status = 400
            ctx.body = { error: 'Invalid request body', ...metadata }
            return
          }

          if (result.err === 'not-found') {
            ctx.status = 404
            ctx.body = {
              reason: 'Listing area text content not found',
              ...metadata,
            }
            return
          }

          ctx.status = 500
          ctx.body = {
            error: 'Failed to update listing area text content',
            ...metadata,
          }
          return
        }

        ctx.status = 200
        ctx.body = { content: result.data, ...metadata }
      } catch (err) {
        logger.error(
          { err, metadata },
          'Error updating listing area text content in leasing'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /listing-area-text-content/{marketAreaCode}:
   *   delete:
   *     summary: Delete listing area text content
   *     description: |
   *       Delete listing area text content.
   *     tags: [ListingAreaTextContent]
   *     parameters:
   *       - in: path
   *         name: marketAreaCode
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The market area code of the listing text content to delete.
   *     responses:
   *       200:
   *         description: Listing area text content deleted successfully
   *       404:
   *         description: Listing area text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/listing-area-text-content/:marketAreaCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { marketAreaCode } = ctx.params

    try {
      const result =
        await leasingAdapter.deleteListingAreaTextContent(marketAreaCode)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            reason: 'Listing area text content not found',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: 'Failed to delete listing area text content',
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = { content: null, ...metadata }
    } catch (err) {
      logger.error(
        { err, metadata },
        'Error deleting listing area text content in leasing'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
