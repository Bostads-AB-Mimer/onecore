import { SyncContactToEconomySchema } from '@onecore/types'
import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import {
  syncCustomer,
  SyncCustomerPayload,
} from '@src/services/customer-service/service'

const payload: SyncCustomerPayload = {
  contactCode: 'P99999',
  fullName: 'Testsson, Test',
  address: {
    street: 'Testgatan 5',
    postalCode: '11111',
    city: 'Stockholm',
  },
  emailAddress: 'test@test.se',
}

describe('syncCustomer', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns null and does not create when customer does not exist and create is not requested', async () => {
    jest.spyOn(xledgerAdapter, 'getCustomer').mockResolvedValueOnce(undefined)
    const addSpy = jest.spyOn(xledgerAdapter, 'addCustomer')
    const updateSpy = jest.spyOn(xledgerAdapter, 'updateCustomer')

    const result = await syncCustomer(payload)

    expect(result).toBeNull()
    expect(addSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('creates customer when customer does not exist and create is requested', async () => {
    jest.spyOn(xledgerAdapter, 'getCustomer').mockResolvedValueOnce(undefined)
    const addSpy = jest
      .spyOn(xledgerAdapter, 'addCustomer')
      .mockResolvedValueOnce({ dbId: '12345' } as any)

    const result = await syncCustomer(payload, true)

    expect(addSpy).toHaveBeenCalledWith({
      contactCode: payload.contactCode,
      fullName: payload.fullName,
      address: payload.address,
      emailAddress: payload.emailAddress,
    })
    expect(result).toEqual({ customer: { dbId: '12345' }, previous: null })
  })

  it('updates customer when customer already exists', async () => {
    const existingCustomer = { dbId: '12345' }
    jest
      .spyOn(xledgerAdapter, 'getCustomer')
      .mockResolvedValueOnce(existingCustomer as any)
    const updateSpy = jest
      .spyOn(xledgerAdapter, 'updateCustomer')
      .mockResolvedValueOnce({ dbId: '12345', updated: true } as any)
    const addSpy = jest.spyOn(xledgerAdapter, 'addCustomer')

    const result = await syncCustomer(payload)

    expect(updateSpy).toHaveBeenCalledWith(existingCustomer, {
      contactCode: payload.contactCode,
      fullName: payload.fullName,
      address: payload.address,
      emailAddress: payload.emailAddress,
    })
    expect(addSpy).not.toHaveBeenCalled()
    expect(result).toEqual({
      customer: { dbId: '12345', updated: true },
      previous: {
        fullName: '',
        street: null,
        zipCode: null,
        city: null,
        emailAddress: null,
      },
    })
  })

  it('returns the values it replaced as previous when it updates', async () => {
    jest.spyOn(xledgerAdapter, 'getCustomer').mockResolvedValueOnce({
      dbId: '12345',
      description: 'Gammal, Namn',
      address: {
        streetAddress: 'Gamla gatan 1',
        streetNumber: null,
        zipCode: '22222',
        place: 'Västerås',
      },
      email: 'gammal@test.se',
    } as any)
    jest
      .spyOn(xledgerAdapter, 'updateCustomer')
      .mockResolvedValueOnce('12345' as any)

    const result = await syncCustomer(payload)

    expect(result).toEqual({
      customer: '12345',
      previous: {
        fullName: 'Gammal, Namn',
        street: 'Gamla gatan 1',
        zipCode: '22222',
        city: 'Västerås',
        emailAddress: 'gammal@test.se',
      },
    })
  })

  it('maps a customer without address or email to nulls that pass the sync schema', async () => {
    jest.spyOn(xledgerAdapter, 'getCustomer').mockResolvedValueOnce({
      dbId: '1',
      description: 'Utan Adress',
      address: null,
      email: null,
    } as any)
    jest
      .spyOn(xledgerAdapter, 'updateCustomer')
      .mockResolvedValueOnce('1' as any)

    const result = await syncCustomer(payload)

    expect(result?.previous).toEqual({
      fullName: 'Utan Adress',
      street: null,
      zipCode: null,
      city: null,
      emailAddress: null,
    })
    expect(
      SyncContactToEconomySchema.safeParse({
        contactCode: 'P1',
        ...result?.previous,
      }).success
    ).toBe(true)
  })

  it('defaults missing address fields to empty strings', async () => {
    jest.spyOn(xledgerAdapter, 'getCustomer').mockResolvedValueOnce(undefined)
    const addSpy = jest
      .spyOn(xledgerAdapter, 'addCustomer')
      .mockResolvedValueOnce({ dbId: '1' } as any)

    await syncCustomer(
      {
        contactCode: 'P1',
        fullName: 'Test',
        address: undefined,
        emailAddress: '',
      },
      true
    )

    expect(addSpy).toHaveBeenCalledWith({
      contactCode: 'P1',
      fullName: 'Test',
      address: { street: '', postalCode: '', city: '' },
      emailAddress: '',
    })
  })
})
