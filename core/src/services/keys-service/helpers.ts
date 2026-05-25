import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { LogsApi } from '../../adapters/keys-adapter'
import { contactsAdapter } from '../../adapters/contacts-adapter'
import { transformContacts } from '../../api/v1/contacts/transform'

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

/**
 * Batch-fetches contacts by code and returns them keyed by contactCode,
 * ready to attach as a `contacts` sidecar on a route response.
 *
 * Soft-fails: if the contacts service errors, returns undefined and logs.
 * Callers should then omit the `contacts` field — the FE renders the raw
 * contact codes as a fallback.
 *
 * @param contactCodes - Raw codes from the parent items; falsy/non-string
 *                       values are filtered out and duplicates deduped.
 * @param metadata - Route metadata, used only for log context.
 */
export const enrichWithContacts = async (
  contactCodes: Array<string | null | undefined>,
  metadata: ReturnType<typeof generateRouteMetadata>
): Promise<
  Record<string, ReturnType<typeof transformContacts>[number]> | undefined
> => {
  const codes = Array.from(
    new Set(
      contactCodes.filter(
        (c): c is string => typeof c === 'string' && c.length > 0
      )
    )
  )
  if (codes.length === 0) return undefined

  const result = await contactsAdapter.getByContactCodeBatch(codes)
  if (!result.ok) {
    logger.error(
      { err: result.err, codeCount: codes.length, metadata },
      'Failed to enrich with contacts — returning without sidecar'
    )
    return undefined
  }

  return Object.fromEntries(
    transformContacts(result.data).map((c) => [c.contactCode, c])
  )
}
