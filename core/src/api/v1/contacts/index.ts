import z from 'zod'
import { OkapiRouter } from 'koa-okapi-router'

import { GetContactsResponseBody, OneCOREHateOASResponseBody } from './schema'
import { generateRouteMetadata } from '@onecore/utilities'

import * as contactsAdapter from '../../../adapters/contacts-adapter'

export const routes = (router: OkapiRouter) => {
  router.get(
    '/v1/contacts',
    {
      summary: 'List and filter(search) for contact information',
      description: 'Filtering can be done by wildcard search',
      tags: ['Contacts'],
      query: {
        q: {
          description: 'Wildcard search string',
          schema: z.optional(z.array(z.string())),
        },
        test: {
          description: 'Wildcard search string',
          schema: z.optional(z.enum(['tomte', 'korv', 'hästfest'])),
        },
        page: {
          description: 'Page number for paginated results',
          schema: z.optional(z.number()),
        },
        pageSize: {
          description: 'Page size number for paginated results',
          schema: z.optional(z.number()),
        },
      },
      response: {
        200: GetContactsResponseBody,
        404: OneCOREHateOASResponseBody,
        500: OneCOREHateOASResponseBody,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const { q, page, pageSize } = ctx.query

      const response = await contactsAdapter.listContacts(
        q ?? [],
        page,
        pageSize
      )

      if (response.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            contacts: response.data,
          },
          ...metadata,
        }
      } else {
        ctx.status = response.statusCode ?? 500
      }
    }
  )
}
