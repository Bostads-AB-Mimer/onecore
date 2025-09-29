import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'
import { importNewFiles } from './service'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/procurement-invoices/import-new-files', async (ctx) => {
    try {
      const invoiceRows = await importNewFiles()
      ctx.status = 200
      ctx.contentType = 'text/plain'
      if (invoiceRows) {
        ctx.body = invoiceRows.join('\n')
      }
    } catch (error: any) {
      logger.error(error, 'Error importing excel files')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
