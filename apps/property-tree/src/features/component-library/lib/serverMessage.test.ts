import { describe, expect, it } from 'vitest'

import { ApiError, toApiError } from '@/services/api/core/apiError'

import { serverMessage } from './serverMessage'

const failed = (status: number, body: unknown) =>
  toApiError(body, new Response(null, { status }))

describe('serverMessage', () => {
  it("reads core's reason for a refused change", () => {
    expect(
      serverMessage(
        failed(409, { error: 'Kan inte ta bort: modellen har 3 komponenter' })
      )
    ).toBe('Kan inte ta bort: modellen har 3 komponenter')
  })

  it("leaves out core's English text for other statuses", () => {
    expect(
      serverMessage(failed(500, { error: 'Internal server error' }))
    ).toBeUndefined()
    expect(serverMessage(failed(400, { error: [{ path: 'x' }] }))).toBe(
      undefined
    )
  })

  it('ignores anything else', () => {
    expect(serverMessage(new Error('boom'))).toBeUndefined()
    expect(serverMessage({ error: 'Kan inte ta bort' })).toBeUndefined()
    expect(serverMessage(null)).toBeUndefined()
  })
})

describe('toApiError', () => {
  it('keeps the status and a fallback message when core sends no text', () => {
    const error = failed(500, { error: [{ path: 'x' }] })
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(500)
    expect(error.message).toBe('Request failed (status 500)')
  })
})
