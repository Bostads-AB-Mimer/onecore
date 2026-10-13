import KoaRouter from '@koa/router'
import { leasing } from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import { registerSchema } from '../../utils/openapi'
import { getVacantApartments } from './services/get-vacant-apartments'

export const routes = (router: KoaRouter) => {
  registerSchema('VacantApartment', leasing.VacantApartmentSchema)

  /**
   * @swagger
   * /vacant-apartments:
   *   get:
   *     summary: Apartments ready to be published
   *     tags:
   *       - Lease service
   *     description: |
   *       Apartments that are vacant or becoming vacant (Tenfast), described
   *       by the property service, not under an indefinite rental block, and
   *       not already published or further along in the letting process. Each
   *       row carries its draft listing (if any) and how many earlier rounds
   *       closed without a tenant since the apartment was last let.
   *     responses:
   *       '200':
   *         description: The vacant apartments.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/VacantApartment'
   *       '500':
   *         description: One of the upstream services failed.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/vacant-apartments', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await getVacantApartments()

    if (!result.ok) {
      logger.error({ err: result.err }, 'Error fetching vacant apartments')
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })
}
