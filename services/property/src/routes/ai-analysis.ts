import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import {
  AnalyzeComponentImageRequestSchema,
  AIComponentAnalysisSchema,
} from '../types/component'
import { analyzeComponentImage } from '../adapters/berget-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: AI Analysis
 *     description: AI-powered analysis operations for components
 */

export const routes = (router: KoaRouter) => {
  // ==================== AI COMPONENT ANALYSIS (MVP) ====================

  /**
   * @swagger
   * /components/analyze-image:
   *   post:
   *     summary: Analyze component image(s) using AI
   *     description: Upload photos to identify component type, model, or condition using AI image analysis. Can accept a typeplate/label image, product photo, or both for improved accuracy.
   *     tags:
   *       - AI Analysis
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - image
   *             properties:
   *               image:
   *                 type: string
   *                 description: Base64 encoded primary image (max 10MB) - can be typeplate or product photo
   *               additionalImage:
   *                 type: string
   *                 description: Optional additional base64 encoded image (max 10MB) - combine typeplate + product photo for best results
   *     responses:
   *       200:
   *         description: Component analysis successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     componentCategory:
   *                       type: string
   *                       nullable: true
   *                       description: Broad category (e.g., Vitvara)
   *                     componentType:
   *                       type: string
   *                       nullable: true
   *                       description: Component type (e.g., Kylskåp, Diskmaskin, Tvättmaskin)
   *                     componentSubtype:
   *                       type: string
   *                       nullable: true
   *                       description: Specific variant (e.g., 60cm integrerad, Fristående 190-215 liter)
   *                     manufacturer:
   *                       type: string
   *                       nullable: true
   *                       description: Brand/manufacturer name
   *                     model:
   *                       type: string
   *                       nullable: true
   *                       description: Model name/number
   *                     serialNumber:
   *                       type: string
   *                       nullable: true
   *                       description: Serial number from nameplate
   *                     estimatedAge:
   *                       type: string
   *                       nullable: true
   *                       description: Estimated age as text (e.g., 5-10 år)
   *                     condition:
   *                       type: string
   *                       nullable: true
   *                       description: Visual condition assessment (e.g., Gott skick)
   *                     specifications:
   *                       type: string
   *                       nullable: true
   *                       description: Technical specifications from label
   *                     dimensions:
   *                       type: string
   *                       nullable: true
   *                       description: Physical dimensions if visible (e.g., 60x60x85 cm)
   *                     warrantyMonths:
   *                       type: integer
   *                       nullable: true
   *                       description: Warranty duration in months if visible
   *                     ncsCode:
   *                       type: string
   *                       nullable: true
   *                       description: NCS color code if visible (format XXX or XXX.XXX)
   *                     additionalInformation:
   *                       type: string
   *                       nullable: true
   *                       description: Any other relevant visible information
   *                     confidence:
   *                       type: number
   *                       description: AI confidence score (0.0-1.0)
   *       400:
   *         description: Invalid request (e.g., image too large)
   *       500:
   *         description: AI analysis failed
   */
  router.post(
    '(.*)/components/analyze-image',
    parseRequest({
      body: AnalyzeComponentImageRequestSchema,
    }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      try {
        const { image, additionalImage } = ctx.request.parsedBody
        const analysis = await analyzeComponentImage(image, additionalImage)

        ctx.status = 200
        ctx.body = {
          content: analysis,
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'components.analyze-image')
        const errorMessage =
          err instanceof Error ? err.message : 'AI analysis failed'

        // Map specific errors to appropriate HTTP status codes
        if (errorMessage === 'Invalid Berget AI API key') {
          ctx.status = 401
        } else if (errorMessage === 'Berget AI rate limit exceeded') {
          ctx.status = 429
        } else if (errorMessage === 'Berget AI request timeout') {
          ctx.status = 504
        } else {
          ctx.status = 500
        }

        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  // TODO: Future enhancement - Add mode parameter validation when TYPE_PLATE mode is implemented
  // TODO: Future enhancement - Add rate limiting per user/IP
  // TODO: Future enhancement - Add more detailed error message for oversized images
}
