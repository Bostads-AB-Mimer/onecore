import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeyLoansApi } from '../../adapters/keys-adapter'
import { getUserName, createLogEntry } from './helpers'

export const routes = (router: KoaRouter) => {
  router.get('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-loans/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'keyNameOrObjectCode',
      'minKeys',
      'maxKeys',
      'hasPickedUp',
      'hasReturned',
    ])

    const result = await KeyLoansApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  router.get('/key-loans/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.getByKey(ctx.params.keyId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching loans by key ID'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-loans/by-card/:cardId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.getByCard(ctx.params.cardId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching loans by card ID'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-loans/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'contact',
      'contact2',
      'includeReceipts',
      'returned',
    ])

    const contact = ctx.query.contact as string | undefined
    const contact2 = ctx.query.contact2 as string | undefined
    const includeReceipts = ctx.query.includeReceipts === 'true'
    const returnedParam = ctx.query.returned

    let returned: boolean | undefined = undefined
    if (returnedParam === 'true') {
      returned = true
    } else if (returnedParam === 'false') {
      returned = false
    }

    const result = await KeyLoansApi.getByRentalObject(
      ctx.params.rentalObjectCode,
      contact,
      contact2,
      includeReceipts,
      returned
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key loans by rental object'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-loans/by-contact/:contact/with-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['loanType', 'returned'])

    const loanTypeParam = ctx.query.loanType as string | undefined
    const returnedParam = ctx.query.returned

    let loanType: 'TENANT' | 'MAINTENANCE' | undefined = undefined
    if (loanTypeParam === 'TENANT' || loanTypeParam === 'MAINTENANCE') {
      loanType = loanTypeParam
    }

    let returned: boolean | undefined = undefined
    if (returnedParam === 'true') {
      returned = true
    } else if (returnedParam === 'false') {
      returned = false
    }

    const result = await KeyLoansApi.getByContactWithKeys(
      ctx.params.contact,
      loanType,
      returned
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key loans with keys by contact'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-loans/by-bundle/:bundleId/with-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['loanType', 'returned'])

    const loanTypeParam = ctx.query.loanType as string | undefined
    const returnedParam = ctx.query.returned

    let loanType: 'TENANT' | 'MAINTENANCE' | undefined = undefined
    if (loanTypeParam === 'TENANT' || loanTypeParam === 'MAINTENANCE') {
      loanType = loanTypeParam
    }

    let returned: boolean | undefined = undefined
    if (returnedParam === 'true') {
      returned = true
    } else if (returnedParam === 'false') {
      returned = false
    }

    const result = await KeyLoansApi.getByBundleWithKeys(
      ctx.params.bundleId,
      loanType,
      returned
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key loans with keys by bundle'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeKeySystem',
      'includeCards',
      'includeLoans',
      'includeEvents',
    ])
    const includeKeySystem = ctx.query.includeKeySystem === 'true'
    const includeCards = ctx.query.includeCards === 'true'
    const includeLoans = ctx.query.includeLoans === 'true'
    const includeEvents = ctx.query.includeEvents === 'true'

    const result = await KeyLoansApi.get(ctx.params.id, {
      includeKeySystem,
      includeCards,
      includeLoans,
      includeEvents,
    })

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.post('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const enrichedPayload = {
      ...payload,
      createdBy: getUserName(ctx) || null,
    }

    const result = await KeyLoansApi.create(enrichedPayload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'One or more keys already have active loans',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'creation',
      objectType: 'keyLoan',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Skapad',
    })

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  router.put('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const enrichedPayload = {
      ...payload,
      updatedBy: getUserName(ctx) || null,
    }

    const result = await KeyLoansApi.update(ctx.params.id, enrichedPayload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'One or more keys already have active loans',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keyLoan',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Uppdaterad',
    })

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.delete('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const getResult = await KeyLoansApi.get(ctx.params.id)
    if (!getResult.ok) {
      if (getResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }
      logger.error(
        { err: getResult.err, metadata },
        'Error fetching key loan before deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const result = await KeyLoansApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'delete',
      objectType: 'keyLoan',
      objectId: ctx.params.id,
      autoGenerateDescription: true,
      entityData: getResult.data,
      action: 'Raderad',
    })

    ctx.status = 200
    ctx.body = { ...metadata }
  })
}
