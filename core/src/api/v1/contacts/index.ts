import z from 'zod'
import { OkapiRouter } from 'koa-okapi-router'

import {
  ContactSchema,
  CreateContactErrorResponseBodySchema_APIv1,
  CreateContactRequestBodySchema_APIv1,
  CreateContactResponseBodySchema_APIv1,
  GetContactResponseBodySchema,
  GetContactsListResponseBodySchema,
  ONECoreHateOASResponseBodySchema,
} from './schema'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
  RouteMetadata,
} from '@onecore/utilities'
import { paginatedResponseSchema, WaitingListType } from '@onecore/types'

import { makeContactsAdapter } from '../../../adapters/contacts-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { makeClientApplicationProfileRequestParams } from '../../../services/lease-service/helpers/application-profile'
import { transformContact, transformContacts } from './transform'
import { Config } from '@/common/config'
import { AdapterResult } from '@/adapters/types'
import type { Contact } from '@onecore/contacts/domain'
import { ParameterizedContext } from 'koa'

/**
 * Status a create failure maps to.
 *
 * Only reachable before the contact exists — once it does, the route always
 * answers 201 and reports later problems as warnings instead.
 */
type CreateContactFailureStatus = 400 | 409 | 422 | 502 | 503

const CREATE_CONTACT_STATUS: Record<string, CreateContactFailureStatus> = {
  'duplicate-contact': 409,
  'invalid-national-id': 422,
  'invalid-request': 400,
  'xpand-rejected': 422,
  'xpand-fault': 502,
  'xpand-auth-failed': 502,
  'xpand-malformed-response': 502,
  'xpand-unavailable': 503,
  'write-backend-not-configured': 503,
  'contacts-service-error': 502,
}

/** Swedish queue names for caseworker-facing warnings. */
const WAITING_LIST_LABELS: Record<WaitingListType, string> = {
  [WaitingListType.Housing]: 'bostad',
  [WaitingListType.ParkingSpace]: 'bilplats',
  [WaitingListType.Storage]: 'förråd',
}

export const routes = (router: OkapiRouter, config: Config) => {
  const contactsServiceUrl = config.contactsService.url

  const contactsAdapter = makeContactsAdapter(contactsServiceUrl)

  const encodeError = (
    ctx: ParameterizedContext,
    result: AdapterResult<any, any>,
    metadata: RouteMetadata
  ) => {
    ctx.status = !result.ok && result.err === 'not-found' ? 404 : 500
    ctx.body = { ...metadata }
  }

  const encodeSingleResponse = (
    ctx: ParameterizedContext,
    result: AdapterResult<Contact, 'not-found' | 'unknown'>
  ) => {
    const metadata = generateRouteMetadata(ctx)
    if (result.ok) {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        transformContact(result.data),
        metadata
      )
    } else {
      encodeError(ctx, result, metadata)
    }
  }

  const encodeListResponse = (
    ctx: ParameterizedContext,
    result: AdapterResult<Contact[], 'unknown'>
  ) => {
    const metadata = generateRouteMetadata(ctx)

    if (result.ok) {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        transformContacts(result.data),
        metadata
      )
    } else {
      encodeError(ctx, result, metadata)
    }
  }

  router.addEntities({
    ContactV1: ContactSchema,
  })

  router.post(
    '/v1/contacts',
    {
      summary: 'Create a contact',
      description:
        'Creates a contact, then optionally records an application profile ' +
        'and enrols the customer in the requested waiting lists. ' +
        'NOT TRANSACTIONAL. The contact is created in Xpand and cannot be ' +
        'removed. Once it exists this endpoint always answers 201, reporting ' +
        'any later step that failed under `warnings` — those steps are ' +
        'idempotent and should be completed on the created contact rather than ' +
        'by creating it again.',
      tags: ['Contacts'],
      body: {
        name: 'CreateContactRequest',
        schema: CreateContactRequestBodySchema_APIv1,
      },
      response: {
        201: CreateContactResponseBodySchema_APIv1,
        400: CreateContactErrorResponseBodySchema_APIv1,
        409: CreateContactErrorResponseBodySchema_APIv1,
        422: CreateContactErrorResponseBodySchema_APIv1,
        502: CreateContactErrorResponseBodySchema_APIv1,
        503: CreateContactErrorResponseBodySchema_APIv1,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      // OkapiRouter uses the body schema for documentation and typing only, so
      // validation has to happen here or an unchecked body reaches the adapter.
      const parsed = CreateContactRequestBodySchema_APIv1.safeParse(
        ctx.request.body
      )

      if (!parsed.success) {
        ctx.status = 400
        ctx.body = {
          error: 'invalid-request',
          detail: parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
          ...metadata,
        }
        return
      }

      const { applicationProfile, waitingLists, ...contact } = parsed.data

      const created = await contactsAdapter.createContact(contact)

      if (!created.ok) {
        // Nothing was created, so this is a plain failure the caller can act on.
        ctx.status = CREATE_CONTACT_STATUS[created.err] ?? 502
        ctx.body = { error: created.err, detail: created.detail, ...metadata }
        return
      }

      const { contactCode } = created.data
      const warnings: string[] = []

      // From here on the contact exists and we cannot remove it. Every remaining step
      // reports its own outcome; none of them may turn the response into an
      // error, because that would invite a retry that cannot succeed.
      let profileStatus: 'created' | 'skipped' | 'failed' = 'skipped'
      let profileError: string | undefined

      if (applicationProfile) {
        const result =
          await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
            contactCode,
            makeClientApplicationProfileRequestParams(
              applicationProfile,
              undefined
            )
          )

        if (result.ok) {
          profileStatus = 'created'
        } else {
          profileStatus = 'failed'
          profileError = result.err
          warnings.push(
            'Kunden skapades men hushållsuppgifterna kunde inte sparas.'
          )
          logger.error(
            { contactCode, err: result.err },
            'createContact.applicationProfileFailed'
          )
        }
      }

      // Sequential rather than concurrent: these are writes against the same
      // contact, and Xpand's own registration flow issues them one at a time.
      const waitingListResults: {
        waitingListType: WaitingListType
        status: 'created' | 'failed'
        error?: string
      }[] = []

      const failedWaitingList = (
        waitingListType: WaitingListType,
        error: string
      ) => {
        waitingListResults.push({ waitingListType, status: 'failed', error })
        warnings.push(
          `Kunden skapades men kunde inte ställas i kön för ${WAITING_LIST_LABELS[waitingListType]}.`
        )
      }

      for (const waitingListType of waitingLists) {
        try {
          const res = await leasingAdapter.addApplicantToWaitingList(
            contactCode,
            waitingListType
          )

          // The status has to be checked explicitly: the adapter returns the
          // raw axios response, and the shared instance treats everything below
          // 500 as a resolved call. Without this a 404 from leasing would be
          // reported to the caseworker as a queue the customer is now in.
          if (res.status === 201) {
            waitingListResults.push({ waitingListType, status: 'created' })
          } else {
            failedWaitingList(waitingListType, String(res.status))
            logger.error(
              { contactCode, waitingListType, status: res.status },
              'createContact.addToWaitingListRejected'
            )
          }
        } catch (err) {
          failedWaitingList(waitingListType, 'unknown')
          logger.error(
            { contactCode, waitingListType, err },
            'createContact.addToWaitingListFailed'
          )
        }
      }

      ctx.status = 201
      ctx.body = {
        ...makeSuccessResponseBody(
          {
            contactCode,
            contact: created.data.contact
              ? transformContact(created.data.contact)
              : null,
            applicationProfile: {
              status: profileStatus,
              ...(profileError ? { error: profileError } : {}),
            },
            waitingLists: waitingListResults,
          },
          metadata
        ),
        ...(warnings.length > 0 ? { warnings } : {}),
      }
    }
  )

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
        500: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { q, type, page, limit } = ctx.query

      const response = await contactsAdapter.listContacts(
        q ?? [],
        type,
        page,
        limit
      )

      if (response.ok) {
        ctx.status = 200
        ctx.body = {
          ...response.data,
          content: transformContacts(response.data.content),
        }
      } else {
        const metadata = generateRouteMetadata(ctx)
        encodeError(ctx, response, metadata)
      }
    }
  )

  router.get(
    '/v1/contacts/by-codes',
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
        200: z.object({
          content: z.array(ContactSchema),
        }),
        400: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const codesParam = ctx.query.codes as string | undefined

      if (!codesParam) {
        const metadata = generateRouteMetadata(ctx)
        ctx.status = 400
        ctx.body = { ...metadata }
        return
      }

      const codes = codesParam
        .split(',')
        .map((c: string) => c.trim())
        .filter(Boolean)
      if (codes.length === 0) {
        const metadata = generateRouteMetadata(ctx)
        ctx.status = 400
        ctx.body = { ...metadata }
        return
      }

      const result = await contactsAdapter.getByContactCodes(codes)

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: transformContacts(result.data),
        }
      } else {
        const metadata = generateRouteMetadata(ctx)
        encodeError(ctx, result, metadata)
      }
    }
  )

  router.get(
    '/v1/contacts/batch',
    {
      summary: 'Batch lookup of contacts by contact code',
      description:
        'Lean by default — returns base contact fields with empty phone/' +
        'email/address arrays. Set `includePhone`, `includeEmail`, ' +
        '`includeAddress`, or `includeRelations` to include those joins. ' +
        'Missing contact codes are simply absent from the response.',
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
        200: GetContactsListResponseBodySchema,
        500: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const {
        code,
        includePhone,
        includeEmail,
        includeAddress,
        includeRelations,
      } = ctx.query

      const response = await contactsAdapter.getByContactCodeBatch(code, {
        includePhone,
        includeEmail,
        includeAddress,
        includeRelations,
      })

      encodeListResponse(ctx, response)
    }
  )

  router.get(
    '/v1/contacts/:contactCode',
    {
      summary: 'Get a single contact by canonical id (contact code)',
      tags: ['Contacts'],
      params: {
        contactCode: {
          description: 'Contact Code',
          schema: z.string(),
        },
      },
      response: {
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { contactCode } = ctx.params

      const response = await contactsAdapter.getByContactCode(contactCode)

      encodeSingleResponse(ctx, response)
    }
  )

  router.get(
    '/v1/contacts/:contactCode/trustee',
    {
      summary: 'Get the trustee of a contact',
      tags: ['Contacts'],
      params: {
        contactCode: {
          description: 'Contact Code',
          schema: z.string(),
        },
      },
      response: {
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { contactCode } = ctx.params

      const response =
        await contactsAdapter.getByTrusteeOfContactCode(contactCode)

      encodeSingleResponse(ctx, response)
    }
  )

  router.get(
    '/v1/contacts/by-phone-number/:phoneNumber',
    {
      summary: 'List contacts by phone number',
      tags: ['Contacts'],
      params: {
        phoneNumber: {
          description: 'Phone Number',
          schema: z.string(),
        },
      },
      response: {
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { phoneNumber } = ctx.params

      const response = await contactsAdapter.listByPhoneNumber(phoneNumber)

      encodeListResponse(ctx, response)
    }
  )

  router.get(
    '/v1/contacts/by-email-address/:emailAddress',
    {
      summary: 'List contacts by email address',
      tags: ['Contacts'],
      params: {
        emailAddress: {
          description: 'Email Address',
          schema: z.string(),
        },
      },
      response: {
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { emailAddress } = ctx.params

      const response = await contactsAdapter.listByEmailAddress(emailAddress)

      encodeListResponse(ctx, response)
    }
  )

  router.get(
    '/v1/contacts/by-national-id/:nid',
    {
      summary: 'List contacts by national id (Personnummer / Org.nr)',
      tags: ['Contacts'],
      params: {
        nid: {
          description: 'National ID',
          schema: z.string(),
        },
      },
      response: {
        200: GetContactResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { nid } = ctx.params

      const response = await contactsAdapter.getByNationalId(nid)

      encodeSingleResponse(ctx, response)
    }
  )
}
