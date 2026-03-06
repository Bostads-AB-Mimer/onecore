import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail } from './helpers'
import {
  Signature,
  SendSignatureRequest,
  SignatureSchema,
  CommonErr,
  AdapterResult,
} from './types'

export const SignaturesApi = {
  send: async (
    payload: SendSignatureRequest
  ): Promise<
    AdapterResult<Signature, 'bad-request' | 'not-found' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().POST(
        '/signatures/send',
        {
          body: payload as any,
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(SignatureSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /signatures/send failed')
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Signature, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/signatures/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(SignatureSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /signatures/{id} failed')
      return fail('unknown')
    }
  },

  getByResource: async (
    resourceType: string,
    resourceId: string
  ): Promise<AdapterResult<Signature[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/signatures/resource/{resourceType}/{resourceId}',
        {
          params: { path: { resourceType, resourceId } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(SignatureSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /signatures/resource failed')
      return fail('unknown')
    }
  },
}
