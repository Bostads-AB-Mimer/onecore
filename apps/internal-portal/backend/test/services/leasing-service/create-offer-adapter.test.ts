import { AxiosError, AxiosHeaders } from 'axios'
import { CreateOfferErrorCodes } from '@onecore/types'

import { createOffer } from '@/services/leasing-service/adapters/core-adapter'
import { getFromCore } from '@/services/common/adapters/core-adapter'

jest.mock('@/services/common/adapters/core-adapter')

const mockedGetFromCore = getFromCore as jest.MockedFunction<typeof getFromCore>

const coreError = (status: number, error: string) =>
  new AxiosError('core error', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error },
  })

describe(createOffer, () => {
  it('passes service-unavailable through when core answers 503', async () => {
    mockedGetFromCore.mockRejectedValueOnce(
      coreError(503, CreateOfferErrorCodes.ServiceUnavailable)
    )

    const result = await createOffer({ listingId: '1' })

    expect(result).toEqual({
      ok: false,
      err: CreateOfferErrorCodes.ServiceUnavailable,
      statusCode: 503,
    })
  })

  it('answers unknown for any other failure', async () => {
    mockedGetFromCore.mockRejectedValueOnce(coreError(500, 'no-listing'))

    const result = await createOffer({ listingId: '1' })

    expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
  })
})
