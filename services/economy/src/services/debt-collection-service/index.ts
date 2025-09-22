import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'
import {
  CsvError,
  enrichBalanceCorrections,
  enrichRandomInvoices,
  enrichRentCases,
} from './service'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/debt-collection/rent-cases', async (ctx) => {
    try {
      const response = await enrichRentCases(ctx.request.body['csv'])
      if (!response.ok) {
        logger.error(response.error)
        if (response.error instanceof CsvError) {
          ctx.status = 400
          ctx.body = { message: response.error.message }
          return
        }

        throw response.error
      }

      ctx.status = 200
      ctx.contentType = 'text/plain'
      ctx.body = response.file
    } catch (error: any) {
      logger.error(error, 'Error processing rent cases')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/debt-collection/random-invoices', async (ctx) => {
    try {
      const response = await enrichRandomInvoices(ctx.request.body['csv'])
      if (!response.ok) {
        logger.error(response.error)
        if (response.error instanceof CsvError) {
          ctx.status = 400
          ctx.body = { message: response.error.message }
          return
        }

        throw response.error
      }

      ctx.status = 200
      ctx.contentType = 'text/plain'
      ctx.body = response.file
    } catch (error: any) {
      logger.error(error, 'Error processing random invoices')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/debt-collection/balance-corrections', async (ctx) => {
    try {
      const response = await enrichBalanceCorrections(ctx.request.body['csv'])
      if (!response.ok) {
        logger.error(response.error)
        if (response.error instanceof CsvError) {
          ctx.status = 400
          ctx.body = { message: response.error.message }
          return
        }

        throw response.error
      }

      ctx.status = 200
      ctx.contentType = 'text/plain'
      ctx.body = response.file
    } catch (error: any) {
      logger.error(error, 'Error processing balance-corrections')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
