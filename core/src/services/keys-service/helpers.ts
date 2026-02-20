import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { LogsApi } from '../../adapters/keys-adapter'

export const getUserName = (ctx: KoaRouter.RouterContext): string =>
  ctx.state.user?.name || ctx.state.user?.preferred_username || 'system'

export async function createLogEntry(
  ctx: KoaRouter.RouterContext,
  params: Omit<keys.CreateLogRequest, 'userName'>
) {
  try {
    await LogsApi.create({
      userName: getUserName(ctx),
      ...params,
    })
  } catch (error) {
    logger.error(
      {
        error,
        eventType: params.eventType,
        objectType: params.objectType,
        objectId: params.objectId,
      },
      'Failed to create log entry'
    )
  }
}
