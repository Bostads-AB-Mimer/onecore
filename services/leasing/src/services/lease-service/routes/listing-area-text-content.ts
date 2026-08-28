import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import listingAreaTextContentAdapter from '../adapters/listing-area-text-content-adapter'
import { leasing } from '@onecore/types'

import { parseRequestBody } from '../../../middlewares/parse-request-body'

/**
 * @swagger
 * tags:
 *   - name: ListingAreaTextContent
 *     description: Endpoints related to operations regarding listing area text content.
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /listing-area-text-content:
   *   get:
   *     summary: List all listing area text content
   *     description: |
   *       Fetch the listing area text content for all market areas, ordered by market area code.
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
   *                     type: object
   *                     description: The listing area text content
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/listing-area-text-content', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const listingAreaTextContent = await listingAreaTextContentAdapter.list()

      ctx.body = { content: listingAreaTextContent, ...metadata }
    } catch (err) {
      logger.error({ err }, 'Error listing listing area text content')
      ctx.status = 500
      ctx.body = {
        error: 'Failed to list listing area text content',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /listing-area-text-content/{marketAreaCode}:
   *   get:
   *     summary: Get listing area text content by market area code
   *     description: |
   *       Fetch the listing area text content for a specific market area.
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
   *                   type: object
   *                   description: The listing area text content
   *       404:
   *         description: Listing area text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/listing-area-text-content/:marketAreaCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { marketAreaCode } = ctx.params

    try {
      const listingAreaTextContent =
        await listingAreaTextContentAdapter.getByMarketAreaCode(marketAreaCode)

      if (!listingAreaTextContent) {
        ctx.status = 404
        ctx.body = {
          error: 'Listing area text content not found',
          ...metadata,
        }
        return
      }

      ctx.body = { content: listingAreaTextContent, ...metadata }
    } catch (err) {
      logger.error(
        { err, marketAreaCode },
        'Error getting listing area text content'
      )
      ctx.status = 500
      ctx.body = {
        error: 'Failed to get listing area text content',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /listing-area-text-content:
   *   post:
   *     summary: Create listing area text content
   *     description: |
   *       Create new listing area text content for a market area.
   *       Content blocks can be text-based (preamble, headline, subtitle, text, bullet_list)
   *       or links (type: link with name and url fields).
   *     tags: [ListingAreaTextContent]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - marketAreaCode
   *               - contentBlocks
   *             properties:
   *               marketAreaCode:
   *                 type: string
   *                 description: The market area code
   *               contentBlocks:
   *                 type: array
   *                 description: Array of content blocks (text or links)
   *                 items:
   *                   oneOf:
   *                     - type: object
   *                       description: Text content block
   *                       properties:
   *                         type:
   *                           type: string
   *                           enum: [preamble, headline, subtitle, text, bullet_list, bold_text]
   *                         content:
   *                           type: string
   *                     - type: object
   *                       description: Link content block
   *                       properties:
   *                         type:
   *                           type: string
   *                           enum: [link]
   *                         name:
   *                           type: string
   *                           description: Display text for the link
   *                         url:
   *                           type: string
   *                           format: uri
   *                           description: The URL the link points to
   *     responses:
   *       201:
   *         description: Listing area text content created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: The created listing area text content
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
    '(.*)/listing-area-text-content',
    parseRequestBody(leasing.v1.CreateListingAreaTextContentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { marketAreaCode } = ctx.request.body

      const result = await listingAreaTextContentAdapter.create(
        ctx.request.body
      )

      if (!result.ok) {
        if (result.err === 'duplicate') {
          ctx.status = 409
          ctx.body = {
            error: `Listing area text content already exists for market area code: ${marketAreaCode}`,
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
    }
  )

  /**
   * @swagger
   * /listing-area-text-content/{marketAreaCode}:
   *   put:
   *     summary: Update listing area text content
   *     description: |
   *       Update existing listing area text content.
   *       Content blocks can be text-based (preamble, headline, subtitle, text, bullet_list)
   *       or links (type: link with name and url fields).
   *     tags: [ListingAreaTextContent]
   *     parameters:
   *       - in: path
   *         name: marketAreaCode
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The market area code of the listing area text content to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               contentBlocks:
   *                 type: array
   *                 description: Array of content blocks (text or links)
   *                 items:
   *                   oneOf:
   *                     - type: object
   *                       description: Text content block
   *                       properties:
   *                         type:
   *                           type: string
   *                           enum: [preamble, headline, subtitle, text, bullet_list, bold_text]
   *                         content:
   *                           type: string
   *                     - type: object
   *                       description: Link content block
   *                       properties:
   *                         type:
   *                           type: string
   *                           enum: [link]
   *                         name:
   *                           type: string
   *                           description: Display text for the link
   *                         url:
   *                           type: string
   *                           format: uri
   *                           description: The URL the link points to
   *     responses:
   *       200:
   *         description: Listing area text content updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: The updated listing area text content
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
    '(.*)/listing-area-text-content/:marketAreaCode',
    parseRequestBody(leasing.v1.UpdateListingAreaTextContentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { marketAreaCode } = ctx.params

      const result = await listingAreaTextContentAdapter.update(
        marketAreaCode,
        ctx.request.body
      )

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: 'Listing area text content not found',
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

      ctx.body = { content: result.data, ...metadata }
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
   *           The market area code of the listing area text content to delete.
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
  router.delete(
    '(.*)/listing-area-text-content/:marketAreaCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { marketAreaCode } = ctx.params

      const result = await listingAreaTextContentAdapter.remove(marketAreaCode)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: 'Listing area text content not found',
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
    }
  )
}
