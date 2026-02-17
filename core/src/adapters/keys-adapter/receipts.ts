import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail } from './helpers'
import {
  Receipt,
  CreateReceiptRequest,
  ReceiptSchema,
  CommonErr,
  AdapterResult,
} from './types'

export const ReceiptsApi = {
  create: async (
    payload: CreateReceiptRequest & { fileId?: string }
  ): Promise<
    AdapterResult<Receipt, 'bad-request' | 'conflict' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().POST('/receipts', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(ReceiptSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /receipts failed')
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Receipt, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/receipts/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(ReceiptSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /receipts/{id} failed')
      return fail('unknown')
    }
  },

  getByKeyLoan: async (
    keyLoanId: string
  ): Promise<AdapterResult<Receipt[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/receipts/by-key-loan/{keyLoanId}',
        {
          params: { path: { keyLoanId } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(ReceiptSchema).parse((data as any).content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /receipts/by-key-loan failed')
      return fail('unknown')
    }
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    try {
      const { error, response } = await client().DELETE('/receipts/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(undefined)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: DELETE /receipts/{id} failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: Partial<Receipt>
  ): Promise<
    AdapterResult<Receipt, 'not-found' | 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().PUT('/receipts/{id}', {
        params: { path: { id } },
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(ReceiptSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /receipts/{id} failed')
      return fail('unknown')
    }
  },
}
