import KoaRouter from '@koa/router'

import * as ecnomyAdapter from '../../adapters/economy-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Economy service
 *     description: Operations related to economy
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
  router.get('/invoices/:invoiceId', async (ctx) => {
    const result = await ecnomyAdapter.getInvoiceByInvoiceId(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    } else {
      ctx.status = 200
      ctx.body = result.data
    }
  })

  router.get('/invoices/by-contact-code/:contactCode', async (ctx) => {
    const result = await ecnomyAdapter.getInvoicesByContactCode(
      ctx.params.contactCode
    )

    if (!result.ok) {
      ctx.status = 500
      return
    } else {
      ctx.status = 200
      ctx.body = result.data
    }
  })
}
