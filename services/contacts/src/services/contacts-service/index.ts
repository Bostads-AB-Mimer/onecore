import z from 'zod'
import { OkapiRouter } from 'koa-okapi-router'
import { generateRouteMetadata } from '@onecore/utilities'
import { ContactsRepository } from '@src/adapters/contact-adapter'
import {
  GetContactResponseBody,
  GetContactsResponseBody,
  OneCOREHateOASResponseBody,
} from './schema'

export const routes = (
  router: OkapiRouter,
  { contactsRepository }: { contactsRepository: ContactsRepository }
) => {
  router.get(
    '/contacts',
    {
      summary: 'List and filter(search) for contact information',
      description: 'Filtering can be done by wildcard search',
      tags: ['Contacts'],
      query: {
        q: {
          description: 'Wildcard search string',
          schema: z.optional(z.array(z.string())),
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
        404: z.null(),
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ctx.queryParameterNames ?? [])

      const wildcard = ctx.query.q
      const page = Number(ctx.query.page) ?? 0
      const pageSize = Number(ctx.query.pageSize) ?? 10

      const result = await contactsRepository.list({
        filter: {
          wildcard: wildcard,
        },
        page,
        pageSize,
      })

      ctx.status = 200
      ctx.body = {
        ...metadata,
        content: {
          contacts: result,
        },
      }
    }
  )

  router.get(
    '/contacts/:contactCode',
    {
      summary: 'Get a single contact by their canonical ID.',
      description: `Get a single contact by their Contact Code.`,
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
      },
      response: {
        200: GetContactResponseBody,
        404: OneCOREHateOASResponseBody,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { contactCode } = ctx.params
      const result = await contactsRepository.getByContactCode(contactCode)

      if (result) {
        ctx.status = 200
        ctx.body = {
          content: result,
          ...metadata,
        }
      } else {
        ctx.status = 404
      }
    }
  )

  router.get(
    '/contacts/by-phone-number/:phoneNumber',
    {
      summary: 'Get a single contact by phone number',
      description: `Get a single contact by their phone number.
      Phone numbers are not necessarily unique.
      If no match is found this endpoint will respond with 404.`,
      tags: ['Contacts'],
      params: {
        phoneNumber: z.string(),
      },
      response: {
        200: GetContactsResponseBody,
        404: OneCOREHateOASResponseBody,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await contactsRepository.getByPhoneNumber(
        ctx.params?.phoneNumber as string
      )

      if (!result) {
        ctx.status = 404
        ctx.body = {
          ...metadata,
        }
      } else {
        ctx.body = {
          ...metadata,
          content: { contacts: [result] },
        }
      }
    }
  )

  router.get(
    '/contacts/by-nid/:nid',
    {
      summary: 'Get a single contact by their National ID (personnummer)',
      tags: ['Contacts'],
      body: z.null(),
      params: {
        nid: z.string(),
      },
      response: {
        200: GetContactResponseBody,
        404: OneCOREHateOASResponseBody,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ctx.queryParameterNames ?? [])

      const result = await contactsRepository.getByNationalIdNumber(
        ctx.params.nid
      )

      if (!result) {
        ctx.status = 404
        ctx.body = {
          ...metadata,
        }
      } else {
        ctx.body = {
          ...metadata,
          content: result,
        }
      }
    }
  )
}
