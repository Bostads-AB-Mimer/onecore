import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  AnalyzeScannerImageRequestSchema,
  AIScannerAnalysisResultSchema,
} from '../types/ai-analysis'
import { analyzeScannerImage } from '../services/ai-scanner-service'

/**
 * @swagger
 * tags:
 *   - name: AI Scanner
 *     description: AI-powered image analysis for inventory scanning
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /ai-scanner/analyze:
   *   post:
   *     summary: Analyze an image using AI for inventory scanning
   *     description: Uses Berget AI to analyze images of components and extract information like type, brand, model, serial number, and condition.
   *     tags: [AI Scanner]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AnalyzeScannerImageRequest'
   *     responses:
   *       200:
   *         description: AI analysis result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/AIScannerAnalysisResult'
   *       400:
   *         description: Invalid request
   *       500:
   *         description: Internal server error
   */
  router.post(
    '(.*)/ai-scanner/analyze',
    parseRequest({ body: AnalyzeScannerImageRequestSchema }),
    async (ctx) => {
      const request = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await analyzeScannerImage(request)

        ctx.body = {
          content: AIScannerAnalysisResultSchema.parse(result),
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )
}
