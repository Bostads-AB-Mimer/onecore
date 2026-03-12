import KoaRouter from '@koa/router'
import { z } from 'zod'
import { logger, generateRouteMetadata } from '@onecore/utilities'

import * as communicationAdapter from '../../adapters/communication-adapter'
import { registerSchema } from '../../utils/openapi'

const BulkSmsResult = z.object({
  successful: z.array(z.string()).describe('Phone numbers that received SMS'),
  invalid: z.array(z.string()).describe('Invalid phone numbers'),
  totalSent: z.number(),
  totalInvalid: z.number(),
})

const BulkEmailResult = z.object({
  successful: z
    .array(z.string())
    .describe('Email addresses that received email'),
  invalid: z.array(z.string()).describe('Invalid email addresses'),
  totalSent: z.number(),
  totalInvalid: z.number(),
})

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Communication service
 *     description: Operations related to communication (SMS, email)
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */

export const routes = (router: KoaRouter) => {
  registerSchema('BulkSmsResult', BulkSmsResult)
  registerSchema('BulkEmailResult', BulkEmailResult)

  /**
   * @swagger
   * /sendBulkSms:
   *   post:
   *     summary: Send SMS to multiple contacts
   *     description: Send SMS messages to multiple phone numbers
   *     tags:
   *       - Communication service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - phoneNumbers
   *               - text
   *             properties:
   *               phoneNumbers:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of phone numbers
   *               text:
   *                 type: string
   *                 description: SMS message content
   *     responses:
   *       '200':
   *         description: SMS sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/BulkSmsResult'
   *       '400':
   *         description: Invalid request
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/sendBulkSms', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await communicationAdapter.sendBulkSms(ctx.request.body)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

  /**
   * @swagger
   * /sendBulkEmail:
   *   post:
   *     summary: Send email to multiple contacts
   *     description: Send email messages to multiple email addresses
   *     tags:
   *       - Communication service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - emails
   *               - subject
   *               - text
   *             properties:
   *               emails:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of email addresses
   *               subject:
   *                 type: string
   *                 description: Email subject
   *               text:
   *                 type: string
   *                 description: Email message content
   *     responses:
   *       '200':
   *         description: Email sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/BulkEmailResult'
   *       '400':
   *         description: Invalid request
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/sendBulkEmail', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await communicationAdapter.sendBulkEmail(ctx.request.body)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

  /**
   * @swagger
   * /getLinearTickets:
   *   get:
   *     summary: Get Linear tickets with mimer-visible label
   *     description: Fetch Linear issues that have the mimer-visible label
   *     tags:
   *       - Communication service
   *     parameters:
   *       - in: query
   *         name: first
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Number of tickets to fetch
   *       - in: query
   *         name: after
   *         schema:
   *           type: string
   *         description: Cursor for pagination
   *     responses:
   *       '200':
   *         description: Linear tickets fetched successfully
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/getLinearTickets', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const firstParam = ctx.query.first
    const afterParam = ctx.query.after
    const first =
      typeof firstParam === 'string' ? parseInt(firstParam, 10) : undefined
    const after = typeof afterParam === 'string' ? afterParam : undefined

    const result = await communicationAdapter.getLinearTickets({ first, after })

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data.tickets,
        pageInfo: result.data.pageInfo,
        ...metadata,
      }
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

  /**
   * @swagger
   * /createLinearErrand:
   *   post:
   *     summary: Create a new Linear errand
   *     description: Create a new issue in Linear with specified team, project, and labels
   *     tags:
   *       - Communication service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *               - description
   *               - categoryLabelId
   *             properties:
   *               title:
   *                 type: string
   *                 description: Errand title
   *               description:
   *                 type: string
   *                 description: Errand description
   *               categoryLabelId:
   *                 type: string
   *                 description: Label ID for category (Bug, Improvement, etc.)
   *     responses:
   *       '200':
   *         description: Linear errand created successfully
   *       '400':
   *         description: Invalid request
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/createLinearErrand', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await communicationAdapter.createLinearErrand(
      ctx.request.body
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

  /**
   * @swagger
   * /getLinearLabels:
   *   get:
   *     summary: Get Linear category labels
   *     description: Fetch available category labels (Bug, Improvement, new feature)
   *     tags:
   *       - Communication service
   *     responses:
   *       '200':
   *         description: Linear labels fetched successfully
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/getLinearLabels', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await communicationAdapter.getLinearLabels()

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
    }
  })
}
