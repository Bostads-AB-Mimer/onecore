import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import {
  getLinearTickets,
  createLinearErrand,
  getLinearLabels,
} from './adapters/linear-adapter'
import { CreateLinearErrandRequest } from './adapters/types'
import z from 'zod'

const CreateLinearErrandSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryLabelId: z.string().uuid('Category label ID must be a valid UUID'),
})

export const routes = (router: KoaRouter) => {
  /**
   * GET /getLinearTickets
   * Retrieves Linear issues with "mimer-visible" label
   * Query params: first (number, default 10), after (cursor string)
   */
  router.get('(.*)/getLinearTickets', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const firstParam = ctx.query.first
    const afterParam = ctx.query.after

    const first = typeof firstParam === 'string' ? parseInt(firstParam, 10) : 10
    const after = typeof afterParam === 'string' ? afterParam : undefined

    try {
      const result = await getLinearTickets({ first, after })
      ctx.status = 200
      ctx.body = {
        content: result.tickets,
        pageInfo: result.pageInfo,
        ...metadata,
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error({ error: errorMessage }, 'Error fetching Linear tickets')
      ctx.status = 500
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  /**
   * POST /createLinearErrand
   * Creates a new issue in Linear with specified team, project, and labels
   */
  router.post(
    '(.*)/createLinearErrand',
    parseRequestBody(CreateLinearErrandSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { title, description, categoryLabelId } = ctx.request
        .body as CreateLinearErrandRequest

      try {
        const issue = await createLinearErrand(
          title,
          description,
          categoryLabelId
        )
        ctx.status = 201
        ctx.body = { content: issue, ...metadata }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        logger.error({ error: errorMessage }, 'Error creating Linear errand')
        ctx.status = 500
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * GET /getLinearLabels
   * Retrieves category labels (Bug, Improvement, new feature)
   */
  router.get('(.*)/getLinearLabels', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const labels = await getLinearLabels()
      ctx.status = 200
      ctx.body = { content: labels, ...metadata }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error({ error: errorMessage }, 'Error fetching Linear labels')
      ctx.status = 500
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
