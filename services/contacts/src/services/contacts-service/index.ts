import z from 'zod'
import { OkapiRouter } from 'koa-okapi-router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
  buildPaginatedResponse,
  parsePaginationParams,
} from '@onecore/utilities'
import { ContactsRepository } from '@src/adapters/contact-adapter'
import {
  ContactSchema,
  ErrorResponseBodySchema,
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  GetRelatedContactsResponseBodySchema,
  ONECoreHateOASResponseBodySchema,
  SyncContactsResponseBodySchema,
} from './schema'
import { paginatedResponseSchema } from '@onecore/types'

// TODO: Remove this helper once we have a request-validation middleware that
// runs route Zod schemas against ctx.query and coerces string "true"/"false"
// to real booleans. OkapiRouter today only uses schemas for OpenAPI docs, so
// boolean query params arrive as raw strings — and `Boolean("false") === true`
// would otherwise silently enable the include even when the caller said no.
const isTrue = (v: unknown): boolean => v === true || v === 'true'

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
    '/contacts/sync',
    {
      summary: 'Get contacts updated since a given timestamp',
      description:
        'Queries cmlog in Xpand for changes since the given timestamp. If no timestamp is provided, returns all matching rows.',
      tags: ['Contacts'],
      query: {
        since: {
          description: 'ISO 8601 timestamp to query changes from',
          schema: z.optional(z.string()),
        },
      },
      response: {
        200: SyncContactsResponseBodySchema,
        400: ErrorResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const sinceParam = ctx.query.since as string | undefined
      const since = sinceParam ? new Date(sinceParam) : null

      if (since && isNaN(since.getTime())) {
        ctx.status = 400
        ctx.body = {
          error: 'Invalid since parameter, expected ISO 8601 date',
          ...metadata,
        }
        return
      }

      const changedCodes =
        await contactsRepository.getChangedContactCodes(since)
      const fetchedContacts = await contactsRepository.getByContactCodes(
        changedCodes.map((c) => c.contactCode)
      )
      const contactByCode = new Map(
        fetchedContacts.map((c) => [c.contactCode, c])
      )

      const contacts = changedCodes
        .map((c) => {
          const contact = contactByCode.get(c.contactCode)
          return contact
            ? { contact, timestamp: c.timestamp.toISOString() }
            : null
        })
        .filter(
          (
            c
          ): c is {
            contact: (typeof fetchedContacts)[number]
            timestamp: string
          } => c !== null
        )

      ctx.status = 200
      ctx.body = {
        content: { contacts },
        ...metadata,
      }
    }
  )

  router.get(
    '/contacts/by-codes',
    {
      summary: 'Get multiple contacts by their contact codes',
      description:
        'Fetch a batch of contacts by providing a comma-separated list of contact codes.',
      tags: ['Contacts'],
      query: {
        codes: {
          description: 'Comma-separated list of contact codes',
          schema: z.string(),
        },
      },
      response: {
        200: GetContactsResponseBodySchema,
        400: ErrorResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const codesParam = ctx.query.codes

      const codes = codesParam
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

      if (codes.length === 0) {
        ctx.status = 400
        ctx.body = {
          error: 'No valid contact codes provided',
          ...metadata,
        }
        return
      }

      const contacts = await contactsRepository.getByContactCodes(codes, {
        includeRelations: true,
      })

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ contacts }, metadata)
    }
  )

  router.get(
    '/contacts/batch',
    {
      summary: 'Batch lookup of contacts by contact code.',
      description:
        'Lean by default — returns base contact fields with empty phone/' +
        'email/address arrays. Pass any combination of `includePhone`, ' +
        '`includeEmail`, `includeAddress` to include those joins; ' +
        "`includeRelations` adds each contact's god man/förvaltare/ward " +
        'relations. Missing contact codes are simply absent from the response.',
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
        includeRelations: {
          description:
            'Include related contacts (guardians/wards) in the response.',
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
      const codes = (Array.isArray(rawCode) ? rawCode : [rawCode]).filter(
        (c): c is string => typeof c === 'string' && c.length > 0
      )

      if (codes.length === 0) {
        ctx.status = 400
        ctx.body = {
          ...metadata,
          error: 'At least one `code` query parameter is required.',
        }
        return
      }

      const contacts = await contactsRepository.getByContactCodeBatch(codes, {
        includePhone: isTrue(ctx.query.includePhone),
        includeEmail: isTrue(ctx.query.includeEmail),
        includeAddress: isTrue(ctx.query.includeAddress),
        includeRelations: isTrue(ctx.query.includeRelations),
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
      summary:
        'DEPRECATED — Get the god man of a contact by their Contact Code',
      description:
        'Deprecated: use GET /contacts/:contactCode/trustees instead, which ' +
        'returns RelatedContact objects. Returns the god man (cmctc.forvtyp = 1) ' +
        'of the given contact as a full Contact. 404 when the contact does not ' +
        'exist or has no god man.',
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
      const relations = await contactsRepository.getTrustees(contactCode)

      if (relations === null) {
        ctx.status = 404
        return
      }

      const godMan = relations[0]
      if (!godMan) {
        ctx.status = 404
        return
      }

      const trustee = await contactsRepository.getByContactCode(
        godMan.contactCode
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
    }
  )

  router.get(
    '/contacts/:contactCode/trustees',
    {
      summary: 'List the god man of a contact',
      description:
        'Returns the contacts registered as god man (cmctc.forvtyp = 1) ' +
        'for the given contact, as RelatedContact objects with role ' +
        "'trustee'. Empty list when the contact has no god man; " +
        '404 when the contact does not exist.',
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
      },
      response: {
        200: GetRelatedContactsResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const relations = await contactsRepository.getTrustees(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = {
        content: { relations },
        ...metadata,
      }
    }
  )

  router.get(
    '/contacts/:contactCode/trustee-for',
    {
      summary: 'List the contacts a person is god man for',
      description:
        'Returns the contacts that have the given contact registered as ' +
        'their god man, as RelatedContact objects with role ' +
        "'ward'. Empty list when the contact is not a god man for anyone; " +
        '404 when the contact does not exist.',
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
      },
      response: {
        200: GetRelatedContactsResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const relations = await contactsRepository.getTrusteeWards(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = {
        content: { relations },
        ...metadata,
      }
    }
  )

  router.get(
    '/contacts/:contactCode/administrators',
    {
      summary: 'List the administrators (förvaltare) of a contact',
      description:
        'Returns the contacts registered as förvaltare (cmctc.forvtyp = 2) ' +
        'for the given contact, as RelatedContact objects with role ' +
        "'administrator'. Empty list when the contact has no förvaltare; " +
        '404 when the contact does not exist.',
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
      },
      response: {
        200: GetRelatedContactsResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const relations = await contactsRepository.getGuardians(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = {
        content: { relations },
        ...metadata,
      }
    }
  )

  router.get(
    '/contacts/:contactCode/administrator-for',
    {
      summary: 'List the contacts a person is administrator (förvaltare) for',
      description:
        'Returns the contacts that have the given contact registered as ' +
        'their förvaltare, as RelatedContact objects with role ' +
        "'ward'. Empty list when the contact is not a förvaltare for anyone; " +
        '404 when the contact does not exist.',
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
      },
      response: {
        200: GetRelatedContactsResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const relations = await contactsRepository.getGuardianWards(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = {
        content: { relations },
        ...metadata,
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
