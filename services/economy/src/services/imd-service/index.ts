import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { z } from 'zod'
import { imdService } from './service'

const ProcessIMDRequestSchema = z.object({
  csv: z.string(),
})

export const routes = (router: KoaRouter) => {
  router.post('(.*)/imd/process', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const parseResult = ProcessIMDRequestSchema.safeParse(ctx.request.body)
    if (!parseResult.success) {
      ctx.status = 400
      return
    }

    try {
      const { csv } = parseResult.data
      const result = await imdService.processIMD(csv)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Processing failed' }
        return
      }

      const { totalRows, enriched, enrichedCsv, unprocessedCsv } = result.data

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        { totalRows, enriched, enrichedCsv, unprocessedCsv },
        metadata
      )
    } catch (err: unknown) {
      logger.error(err, 'Error processing IMD CSV')
      ctx.status = 500
    }
  })
}

export { imdService } from './service'
