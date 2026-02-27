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
   * /contacts/send-bulk-sms:
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
  router.post('(.*)/contacts/send-bulk-sms', async (ctx) => {
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
   * /contacts/send-bulk-email:
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
  router.post('(.*)/contacts/send-bulk-email', async (ctx) => {
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
}
