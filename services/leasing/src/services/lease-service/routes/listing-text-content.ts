import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import listingTextContentAdapter from '../adapters/listing-text-content-adapter'
import { leasing } from '@onecore/types'

/**
 * @swagger
 * tags:
 *   - name: ListingTextContent
 *     description: Endpoints related to operations regarding listing text content.
 */
export const routes = (router: KoaRouter) => {
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
   *                 data:
   *                   type: object
   *                   description: The listing text content
   *       404:
   *         description: Listing text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    const listingTextContent =
      await listingTextContentAdapter.getByRentalObjectCode(rentalObjectCode)

    if (!listingTextContent) {
      ctx.status = 404
      ctx.body = { error: 'Listing text content not found', ...metadata }
      return
    }

    ctx.body = { content: listingTextContent, ...metadata }
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
   *             type: object
   *             properties:
   *               rentalObjectCode:
   *                 type: string
   *                 description: The rental object code
   *               contentBlocks:
   *                 type: array
   *                 description: Array of content blocks
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [preamble, headline, subtitle, text, bullet_list]
   *                     content:
   *                       type: string
   *     responses:
   *       201:
   *         description: Listing text content created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The created listing text content
   *       400:
   *         description: Invalid request body
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/listing-text-content', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parseResult =
      leasing.v1.CreateListingTextContentRequestSchema.safeParse(
        ctx.request.body
      )

    if (!parseResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid request body',
        invalid: ctx.request.body,
        detail: parseResult.error,
        ...metadata,
      }
      return
    }

    const result = await listingTextContentAdapter.create(parseResult.data)

    if (!result.ok) {
      // Check if this is a duplicate rental object code error
      if (result.err.message.includes('already exists for rental object code')) {
        ctx.status = 409
        ctx.body = { error: result.err.message, ...metadata }
        return
      }

      ctx.status = 500
      ctx.body = { error: 'Failed to create listing text content', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

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
   *             type: object
   *             properties:
   *               contentBlocks:
   *                 type: array
   *                 description: Array of content blocks
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [preamble, headline, subtitle, text, bullet_list]
   *                     content:
   *                       type: string
   *     responses:
   *       200:
   *         description: Listing text content updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The updated listing text content
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: Listing text content not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    const parseResult =
      leasing.v1.UpdateListingTextContentRequestSchema.safeParse(
        ctx.request.body
      )

    if (!parseResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid request body',
        invalid: ctx.request.body,
        detail: parseResult.error,
        ...metadata,
      }
      return
    }

    const result = await listingTextContentAdapter.update(
      rentalObjectCode,
      parseResult.data
    )

    if (!result.ok) {
      // Check if this is a "not found" error
      if (result.err.message.includes('not found')) {
        ctx.status = 404
        ctx.body = { error: result.err.message, ...metadata }
        return
      }

      ctx.status = 500
      ctx.body = { error: 'Failed to update listing text content', ...metadata }
      return
    }

    ctx.body = { content: result.data, ...metadata }
  })

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
  router.delete('(.*)/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    const result = await listingTextContentAdapter.remove(rentalObjectCode)

    if (!result.ok) {
      // Check if this is a "not found" error
      if (result.err.message.includes('not found')) {
        ctx.status = 404
        ctx.body = { error: result.err.message, ...metadata }
        return
      }

      ctx.status = 500
      ctx.body = { error: 'Failed to delete listing text content', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: null, ...metadata }
  })
}
