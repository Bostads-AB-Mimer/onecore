import z from 'zod'
import { OkapiRouter } from 'koa-okapi-router'
import {
  generateRouteMetadata,
  buildPaginatedResponse,
  parsePaginationParams,
} from '@onecore/utilities'
import { ContactsRepository } from '@src/adapters/contact-adapter'
import {
  ContactSchema,
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  ONECoreHateOASResponseBodySchema,
} from './schema'
import { paginatedResponseSchema } from '@onecore/types'

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
        type: {
          description: 'Filter on contact type',
          schema: z.optional(z.enum(['individual', 'organisation'])),
        },
        page: {
          description: 'Page number for paginated results (1-based)',
          schema: z.optional(z.number()),
        },
        limit: {
          description: 'Number of records per page',
          schema: z.optional(z.number()),
        },
      },
      response: {
        200: paginatedResponseSchema(ContactSchema),
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { limit, offset } = parsePaginationParams(ctx)

      const result = await contactsRepository.list({
        filter: {
          type: ctx.query.type ?? 'any',
          wildcard: ctx.query.q,
        },
        page: Math.floor(offset / limit),
        pageSize: limit,
      })

      ctx.status = 200
      ctx.body = buildPaginatedResponse({
        content: result.content,
        totalRecords: result.totalRecords,
        ctx,
        additionalParams: {
          ...(ctx.query.q ? { q: String(ctx.query.q) } : {}),
          ...(ctx.query.type ? { type: String(ctx.query.type) } : {}),
        },
      })
    }
  )

  router.get(
    '/contacts/batch',
    {
      summary: 'Batch lookup of contacts by contact code.',
      description:
        'Lean by default — returns base contact fields with empty phone/' +
        'email/address arrays. Pass any combination of `includePhone`, ' +
        '`includeEmail`, `includeAddress` to include those joins. Missing ' +
        'contact codes are simply absent from the response.',
      tags: ['Contacts'],
      query: {
        code: {
          description:
            'Contact code(s) to look up. Repeat the parameter for multiple ' +
            'codes, e.g. ?code=P123&code=P456.',
          schema: z.array(z.string()).min(1),
        },
        includePhone: {
          description: 'Include phone numbers in the response.',
          schema: z.optional(z.boolean()),
        },
        includeEmail: {
          description: 'Include email addresses in the response.',
          schema: z.optional(z.boolean()),
        },
        includeAddress: {
          description: 'Include addresses in the response.',
          schema: z.optional(z.boolean()),
        },
      },
      response: {
        200: GetContactsResponseBodySchema,
        400: ONECoreHateOASResponseBodySchema.extend({ error: z.string() }),
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const rawCode = ctx.query.code
      const codes = (
        Array.isArray(rawCode) ? rawCode : [rawCode]
      ).filter((c): c is string => typeof c === 'string' && c.length > 0)

      if (codes.length === 0) {
        ctx.status = 400
        ctx.body = {
          ...metadata,
          error: 'At least one `code` query parameter is required.',
        }
        return
      }

      const contacts = await contactsRepository.getByContactCodeBatch(codes, {
        includePhone: ctx.query.includePhone,
        includeEmail: ctx.query.includeEmail,
        includeAddress: ctx.query.includeAddress,
      })

      ctx.status = 200
      ctx.body = {
        ...metadata,
        content: { contacts },
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
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
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
    '/contacts/:contactCode/trustee',
    {
      summary: 'Get the trustee of a contact identifier by their Contact Code',
      description: `Get the trustee of a contact.`,
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
      },
      response: {
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { contactCode } = ctx.params
      const contact = await contactsRepository.getByContactCode(contactCode)

      if (contact && contact.type === 'individual' && contact.trustee) {
        const trustee = await contactsRepository.getByContactCode(
          contact.trustee.contactCode
        )

        if (trustee) {
          ctx.status = 200
          ctx.body = {
            content: trustee,
            ...metadata,
          }
        } else {
          ctx.status = 404
        }
      } else {
        ctx.status = 404
      }
    }
  )

  router.get(
    '/contacts/by-phone-number/:phoneNumber',
    {
      summary: 'List contacts by phone number',
      description: `List all contacts associated with a phone number`,
      tags: ['Contacts'],
      params: {
        phoneNumber: z.string(),
      },
      response: {
        200: GetContactsResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await contactsRepository.getByPhoneNumber(
        ctx.params.phoneNumber
      )

      ctx.body = {
        ...metadata,
        content: { contacts: result },
      }
    }
  )

  router.get(
    '/contacts/by-email-address/:emailAddress',
    {
      summary: 'List contacts by email address',
      description: `List all contacts associated with an email address`,
      tags: ['Contacts'],
      params: {
        emailAddress: z.string(),
      },
      response: {
        200: GetContactsResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await contactsRepository.getByEmailAddress(
        decodeURIComponent(ctx.params.emailAddress)
      )

      ctx.body = {
        ...metadata,
        content: { contacts: result },
      }
    }
  )

  router.get(
    '/contacts/by-nid/:nid',
    {
      summary:
        'Get a single contact by their National ID (personnummer / orgnr)',
      tags: ['Contacts'],
      params: {
        nid: z.string(),
      },
      response: {
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
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
