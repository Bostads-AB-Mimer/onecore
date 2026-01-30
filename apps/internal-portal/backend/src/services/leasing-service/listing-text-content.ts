import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    const result =
      await coreAdapter.getListingTextContentByRentalObjectCode(
        rentalObjectCode
      )

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    } else {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'Listing text content not found', ...metadata }
      } else {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
      }
    }
  })

  router.post('(.*)/listing-text-content', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = ctx.request.body

    const result = await coreAdapter.createListingTextContent(params)

    if (result.ok) {
      ctx.status = 201
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    } else {
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'Listing text content already exists for rental object code',
          ...metadata,
        }
      } else {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
      }
    }
  })

  router.put('(.*)/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params
    const params = ctx.request.body

    const result = await coreAdapter.updateListingTextContent(
      rentalObjectCode,
      params
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    } else {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'Listing text content not found', ...metadata }
      } else {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
      }
    }
  })

  router.delete('(.*)/listing-text-content/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    const result = await coreAdapter.deleteListingTextContent(rentalObjectCode)

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    } else {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'Listing text content not found', ...metadata }
      } else {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
      }
    }
  })
}
