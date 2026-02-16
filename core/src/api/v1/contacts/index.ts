import z from 'zod'
import { OkapiRouter } from 'koa-okapi-router'

import {
  ContactSchema,
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  ONECoreHateOASResponseBodySchema,
} from './schema'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
  RouteMetadata,
} from '@onecore/utilities'

import { makeContactsAdapter } from '../../../adapters/contacts-adapter'
import { transformContact, transformContacts } from './transform'
import { Config } from '@/common/config'
import { AdapterResult } from '@/adapters/types'
import type { Contact } from '@onecore/contacts/domain'
import { ParameterizedContext } from 'koa'

export const routes = (router: OkapiRouter, config: Config) => {
  const contactsServiceUrl = config.contactsService.url

  const contactsAdapter = makeContactsAdapter(contactsServiceUrl)

  const encodeError = (
    ctx: ParameterizedContext,
    result: AdapterResult<any, any>,
    metadata: RouteMetadata
  ) => {
    ctx.status =
      result.statusCode == 404 || result.statusCode === 500
        ? result.statusCode
        : 500
    ctx.body = { ...metadata }
  }

  const encodeSingleResponse = (
    ctx: ParameterizedContext,
    result: AdapterResult<Contact, 'unknown'>
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
          description: 'Page number for paginated results',
          schema: z.optional(z.number()),
        },
        pageSize: {
          description: 'Page size number for paginated results',
          schema: z.optional(z.number()),
        },
      },
      response: {
        200: GetContactsResponseBodySchema,
        404: ONECoreHateOASResponseBodySchema,
        500: ONECoreHateOASResponseBodySchema,
      },
    },
    async (ctx) => {
      const { q, type, page, pageSize } = ctx.query

      const response = await contactsAdapter.listContacts(
        q ?? [],
        type,
        page,
        pageSize
      )

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
