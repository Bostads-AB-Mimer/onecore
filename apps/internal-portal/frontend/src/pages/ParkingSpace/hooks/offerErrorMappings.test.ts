import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { CreateOfferErrorCodes, ReplyToOfferErrorCodes } from '@onecore/types'

import { mapCreateOfferErrors } from './createOfferErrorMappings'
import { mapReplyOfferErrors } from './replyToOfferErrorMappings'

const responseError = <E extends string>(status: number, error: E) =>
  new AxiosError<{ error?: E; errorMessage: string }>(
    'error',
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error, errorMessage: error },
    }
  )

describe('offer error mappings', () => {
  it('tells the officer to try again when creating an offer gets service-unavailable', () => {
    const result = mapCreateOfferErrors(
      responseError(503, CreateOfferErrorCodes.ServiceUnavailable)
    )

    expect(result.errorCode).toBe(CreateOfferErrorCodes.ServiceUnavailable)
    expect(result.status).toBe(503)
    expect(result.errorMessage).toContain('Försök igen om en stund')
  })

  it('tells the officer to try again when accepting an offer gets service-unavailable', () => {
    const result = mapReplyOfferErrors(
      responseError(503, ReplyToOfferErrorCodes.ServiceUnavailable)
    )

    expect(result.errorCode).toBe(ReplyToOfferErrorCodes.ServiceUnavailable)
    expect(result.status).toBe(503)
    expect(result.errorMessage).toContain('Försök igen om en stund')
    expect(result.errorMessage).not.toContain('Annons saknas')
  })
})
