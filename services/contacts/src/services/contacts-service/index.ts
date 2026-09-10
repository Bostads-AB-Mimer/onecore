import z from 'zod'
import { OkapiRouter } from 'koa-okapi-router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
  buildPaginatedResponse,
  parsePaginationParams,
} from '@onecore/utilities'
import { ContactsRepository } from '@src/adapters/contact-adapter'
import { ContactWriter } from '@src/adapters/contact-writer'
import { withParsedBody } from '@src/middlewares/parse-request-body'
import { createContact, CreateContactError } from './create-contact'
import {
  addRelation,
  AddRelationError,
  removeRelation,
  RemoveRelationError,
  RelationDependencies,
} from './relations'
import {
  AddRelationRequestBodySchema,
  ContactSchema,
  CreateContactErrorResponseBodySchema,
  CreateContactRequestBodySchema,
  CreateContactResponseBodySchema,
  ErrorResponseBodySchema,
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  GetRelatedContactsResponseBodySchema,
  ONECoreHateOASResponseBodySchema,
  RelationActorSchema,
  RelationErrorResponseBodySchema,
  RelationRoleTypeSchema,
  SyncContactsResponseBodySchema,
} from './schema'
import { paginatedResponseSchema } from '@onecore/types'

// TODO: Remove this helper once we have a request-validation middleware that
// runs route Zod schemas against ctx.query and coerces string "true"/"false"
// to real booleans. OkapiRouter today only uses schemas for OpenAPI docs, so
// boolean query params arrive as raw strings — and `Boolean("false") === true`
// would otherwise silently enable the include even when the caller said no.
const isTrue = (v: unknown): boolean => v === true || v === 'true'

/**
 * Maps a create failure onto an HTTP status.
 *
 * 5xx is split deliberately: 502 means the upstream system answered with
 * something we could not act on, 503 means we never got a usable answer at all
 * and a retry is reasonable. The difference matters because a malformed
 * response may mean the contact was created.
 */
const CREATE_CONTACT_STATUS: Record<CreateContactError, number> = {
  'duplicate-contact': 409,
  'invalid-national-id': 422,
  'xpand-rejected': 422,
  'xpand-fault': 502,
  'xpand-auth-failed': 502,
  'xpand-malformed-response': 502,
  'xpand-unavailable': 503,
  'write-backend-not-configured': 503,
}

/** 409 = the rule is about existing state; 422 = the request is coherent but semantically impossible. */
const ADD_RELATION_STATUS: Record<AddRelationError, number> = {
  'subject-not-found': 404,
  'related-not-found': 404,
  'self-relation': 422,
  'guardian-exists': 409,
  'duplicate-relation': 409,
}

/**
 * Exhaustive so a new removal failure has to pick a status rather than land on
 * 404. `satisfies` rather than an annotation: the DELETE route narrows
 * `ctx.status` to its declared statuses, so the values must stay literal.
 */
const REMOVE_RELATION_STATUS = {
  'relation-not-found': 404,
} as const satisfies Record<RemoveRelationError, number>

export const routes = (
  router: OkapiRouter,
  {
    contactsRepository,
    contactWriter,
    relationDependencies,
  }: {
    contactsRepository: ContactsRepository
    contactWriter: ContactWriter
    relationDependencies: RelationDependencies
  }
) => {
  router.post(
    '/contacts',
    {
      summary: 'Create a contact',
      description:
        'Creates a contact in Xpand together with its applicant role and a web ' +
        'account. Rejects with 409 when a contact with the same national ID ' +
        'already exists. ' +
        'NOT REVERSIBLE HERE. Once 201 is returned the contact exists in Xpand ' +
        'and this API cannot remove it again; cleaning one up means manual work ' +
        'in Xpand. Callers must not retry a request that may have succeeded — a ' +
        'retry is rejected by the duplicate check. ' +
        'Housing queues and the application profile are not handled here; they ' +
        'are orchestrated by the caller.',
      tags: ['Contacts'],
      body: {
        name: 'CreateContactRequest',
        schema: CreateContactRequestBodySchema,
      },
      response: {
        201: CreateContactResponseBodySchema,
        400: ErrorResponseBodySchema,
        409: CreateContactErrorResponseBodySchema,
        422: CreateContactErrorResponseBodySchema,
        502: CreateContactErrorResponseBodySchema,
        503: CreateContactErrorResponseBodySchema,
      },
    },
    withParsedBody(CreateContactRequestBodySchema, async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await createContact(
        { contactsRepository, contactWriter },
        ctx.request.body
      )

      if (!result.ok) {
        ctx.status = CREATE_CONTACT_STATUS[result.err]
        ctx.body = { error: result.err, detail: result.detail, ...metadata }
        return
      }

      ctx.status = 201
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    })
  )

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
        "`includeRelations` adds each contact's god man/förvaltare " +
        'and annan fakturamottagare relations (both directions). Missing ' +
        'contact codes are ' +
        'simply absent from the response.',
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
            'Include related contacts (god man/förvaltare and annan ' +
            'fakturamottagare, both directions) in the response.',
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
      summary: 'Get the trustee (god man) of a contact by their Contact Code',
      description:
        'Returns the trustee (god man) of the given contact as a full ' +
        'Contact. 404 when the contact does not exist or has no trustee.',
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

      const trusteeRelation = relations[0]
      if (!trusteeRelation) {
        ctx.status = 404
        return
      }

      const trustee = await contactsRepository.getByContactCode(
        trusteeRelation.contactCode
      )

      if (trustee) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(trustee, metadata)
      } else {
        ctx.status = 404
      }
    }
  )

  router.get(
    '/contacts/:contactCode/trustee-for',
    {
      summary: 'List the contacts a person is trustee (god man) for',
      description:
        'Returns the contacts that have the given contact registered as ' +
        'their trustee, as RelatedContact objects with role ' +
        "'trusteeFor'. Empty list when the contact is not a trustee for anyone; " +
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
      const relations = await contactsRepository.getTrusteesFor(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ relations }, metadata)
    }
  )

  router.get(
    '/contacts/:contactCode/administrator',
    {
      summary:
        'Get the administrator (förvaltare) of a contact by their Contact Code',
      description:
        'Returns the administrator (förvaltare) of the given contact as a ' +
        'full Contact. 404 when the contact does not exist or has no ' +
        'administrator.',
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
      const relations = await contactsRepository.getAdministrators(contactCode)

      if (relations === null) {
        ctx.status = 404
        return
      }

      const administratorRelation = relations[0]
      if (!administratorRelation) {
        ctx.status = 404
        return
      }

      const administrator = await contactsRepository.getByContactCode(
        administratorRelation.contactCode
      )

      if (administrator) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(administrator, metadata)
      } else {
        ctx.status = 404
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
        "'administratorFor'. Empty list when the contact is not a förvaltare for anyone; " +
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
      const relations = await contactsRepository.getAdministratorsFor(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ relations }, metadata)
    }
  )

  router.get(
    '/contacts/:contactCode/other-invoice-recipients',
    {
      summary:
        'List the other invoice recipients (annan fakturamottagare) of a contact',
      description:
        'Returns the contacts registered as annan fakturamottagare for the ' +
        'contact, as RelatedContact objects with role ' +
        "'otherInvoiceRecipient'. Empty list when there are none; 404 when the " +
        'contact does not exist.',
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
      const relations = await contactsRepository.getOtherInvoiceRecipients(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ relations }, metadata)
    }
  )

  router.get(
    '/contacts/:contactCode/other-invoice-recipient-for',
    {
      summary: 'List the contacts a person is annan fakturamottagare for',
      description:
        'Returns the contacts that have the given contact ' +
        'registered as their annan fakturamottagare, as RelatedContact objects ' +
        "with role 'otherInvoiceRecipientFor'. Empty list when there are none; " +
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
      const relations = await contactsRepository.getOtherInvoiceRecipientsFor(
        ctx.params.contactCode
      )

      if (relations === null) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ relations }, metadata)
    }
  )

  router.post(
    '/contacts/:contactCode/relations',
    {
      summary:
        'Add a related contact (god man, förvaltare, annan fakturamottagare)',
      description:
        'Adds an active relation from the contact to another contact in the ' +
        'given role. A contact can have at most one active god man or ' +
        'förvaltare in total (409 guardian-exists, detail names the existing ' +
        "guardian's contact code when known); the same relation cannot be " +
        'added twice (409 duplicate-relation). Both contacts must exist (404). ' +
        '`createdBy` is the acting user, supplied by the caller. Returns the ' +
        "contact's relations after the change.",
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
      },
      body: {
        name: 'AddRelationRequest',
        schema: AddRelationRequestBodySchema,
      },
      response: {
        201: GetRelatedContactsResponseBodySchema,
        400: ErrorResponseBodySchema,
        404: RelationErrorResponseBodySchema,
        409: RelationErrorResponseBodySchema,
        422: RelationErrorResponseBodySchema,
      },
    },
    withParsedBody(AddRelationRequestBodySchema, async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const result = await addRelation(relationDependencies, {
        subjectContactCode: ctx.params.contactCode,
        ...ctx.request.body,
      })

      if (!result.ok) {
        ctx.status = ADD_RELATION_STATUS[result.err]
        ctx.body = { error: result.err, detail: result.detail, ...metadata }
        return
      }

      const relations = await relationDependencies.relatedContactsFor(
        ctx.params.contactCode
      )
      ctx.status = 201
      ctx.body = makeSuccessResponseBody({ relations }, metadata)
    })
  )

  router.delete(
    '/contacts/:contactCode/relations/:roleType/:relatedContactCode',
    {
      summary: 'Remove a related contact',
      description:
        'Ends the active relation from the contact to the related contact in ' +
        'the given role. The relation is kept as history rather than erased. ' +
        '`deletedBy` (query) is the acting user, supplied by the caller. ' +
        '404 when no such active relation exists.',
      tags: ['Contacts'],
      params: {
        contactCode: z.string(),
        roleType: RelationRoleTypeSchema,
        relatedContactCode: z.string(),
      },
      query: {
        deletedBy: {
          description: 'The acting user, recorded on the removed relation',
          schema: RelationActorSchema,
        },
      },
      response: {
        204: z.undefined(),
        400: RelationErrorResponseBodySchema,
        404: RelationErrorResponseBodySchema,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['deletedBy'])

      // OkapiRouter uses `params` schemas for OpenAPI only — `roleType` is typed as
      // the enum but arrives unvalidated, so this parse is what actually narrows it.
      const roleType = RelationRoleTypeSchema.safeParse(ctx.params.roleType)
      if (!roleType.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid-role-type', ...metadata }
        return
      }

      const deletedBy = RelationActorSchema.safeParse(ctx.query.deletedBy)
      if (!deletedBy.success) {
        ctx.status = 400
        ctx.body = { error: 'missing-deleted-by', ...metadata }
        return
      }

      const result = await removeRelation(relationDependencies, {
        subjectContactCode: ctx.params.contactCode,
        relatedContactCode: ctx.params.relatedContactCode,
        roleType: roleType.data,
        deletedBy: deletedBy.data,
      })

      if (!result.ok) {
        ctx.status = REMOVE_RELATION_STATUS[result.err]
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 204
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
