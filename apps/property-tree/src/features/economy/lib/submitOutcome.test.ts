import { SubmitMiscellaneousInvoiceErrorCodes } from '@onecore/types'
import { describe, expect, it, vi } from 'vitest'

import { SubmitMiscellaneousInvoiceError } from '@/services/api/core/economyService'

import { getSubmitOutcome } from './submitOutcome'

// The real baseApi reads the app environment at import, so it is replaced.
vi.mock('@/services/api/core/baseApi', () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message)
    }
  },
}))

const submitError = (
  status: number,
  code?: SubmitMiscellaneousInvoiceErrorCodes
) => new SubmitMiscellaneousInvoiceError(status, code)

describe('getSubmitOutcome', () => {
  it.each([
    [
      'customer creation failed',
      submitError(
        502,
        SubmitMiscellaneousInvoiceErrorCodes.CustomerCreationFailed
      ),
    ],
    [
      'customer not found after create',
      submitError(
        502,
        SubmitMiscellaneousInvoiceErrorCodes.CustomerNotFoundAfterCreate
      ),
    ],
    ['a validation error', submitError(400)],
    ['an expired login', submitError(401)],
    ['missing permission', submitError(403)],
  ])('is not-sent for %s', (_, error) => {
    expect(getSubmitOutcome(error).kind).toBe('not-sent')
  })

  it.each([
    [
      'an unknown server error',
      submitError(500, SubmitMiscellaneousInvoiceErrorCodes.Unknown),
    ],
    ['a server error without a code', submitError(500)],
    ['a bad gateway without a code', submitError(502)],
    ['a gateway timeout', submitError(504)],
    ['a network failure', new TypeError('Failed to fetch')],
    ['a non-error value', 'boom'],
  ])('is unknown for %s', (_, error) => {
    expect(getSubmitOutcome(error)).toEqual({ kind: 'unknown' })
  })

  it('never tells the user to try again when the outcome is unknown', () => {
    const outcome = getSubmitOutcome(submitError(500))

    expect(outcome).not.toHaveProperty('message')
  })
})
