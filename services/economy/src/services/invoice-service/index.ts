import KoaRouter from '@koa/router'
import { getInvoicesByContactCode } from './adapters/xledger-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/invoices/bycontactcode/:contactCode', async (ctx) => {
    const contactCode = ctx.params.contactCode
    try {
      const result = await getInvoicesByContactCode(contactCode)
      ctx.status = 200
      ctx.body = result
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
