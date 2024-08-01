import KoaRouter from '@koa/router'
import { generateRouteMetadata } from 'onecore-utilities'
import { getCreditInformation } from './adapters/creditsafe-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Creditsafe
 *     description: Operations related to Creditsafe integration
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /cas/getConsumerReport/{pnr}:
   *   get:
   *     summary: Get consumer report for a specific Personal Number (PNR)
   *     tags:
   *       - Creditsafe
   *     description: Retrieves credit information and consumer report for the specified Personal Number (PNR).
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch credit information for.
   *     responses:
   *       '200':
   *         description: Successful response with credit information and consumer report
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  router.get('(.*)/cas/getConsumerReport/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getCreditInformation(ctx.params.pnr)

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })
}
