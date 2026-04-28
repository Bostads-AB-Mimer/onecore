jest.mock('../../../adapters/tenfast/tenfast-api', () => ({
  request: jest.fn(),
}))

import * as tenfastAdapter from '../../../adapters/tenfast/tenfast-adapter'
import { request } from '../../../adapters/tenfast/tenfast-api'
import * as factory from '../../factories'

describe(tenfastAdapter.getOrCreateAndUpdateTenant, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return updated tenant when tenant already exists', async () => {
    // Arrange
    const contact = factory.contact.build()
    const existingTenant = factory.tenfastTenant.build({
      externalId: contact.contactCode,
    })
    const updatedTenant = factory.tenfastTenant.build({
      _id: existingTenant._id,
      externalId: contact.contactCode,
    })

    // First call: getTenantByContactCode → found
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: { records: [existingTenant] },
    })

    // Second call: PATCH to update tenant
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: updatedTenant,
    })

    // Act
    const result = await tenfastAdapter.getOrCreateAndUpdateTenant(contact)

    // Assert
    expect(result).toEqual({ ok: true, data: updatedTenant })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: 'patch' })
    )
  })

  it('should create and update tenant when tenant does not exist', async () => {
    // Arrange
    const contact = factory.contact.build()
    const createdTenant = factory.tenfastTenant.build({
      externalId: contact.contactCode,
    })
    const updatedTenant = factory.tenfastTenant.build({
      _id: createdTenant._id,
      externalId: contact.contactCode,
    })

    // First call: getTenantByContactCode → empty records (not found)
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: { records: [] },
    })

    // Second call: POST to create tenant
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 201,
      data: createdTenant,
    })

    // Third call: PATCH to update tenant
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: updatedTenant,
    })

    // Act
    const result = await tenfastAdapter.getOrCreateAndUpdateTenant(contact)

    // Assert
    expect(result).toEqual({ ok: true, data: updatedTenant })
    expect(request).toHaveBeenCalledTimes(3)
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: 'post' })
    )
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ method: 'patch' })
    )
  })

  it('should return error when tenant retrieval fails', async () => {
    // Arrange
    const contact = factory.contact.build()

    // First call: getTenantByContactCode → failure
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 500,
      data: { error: 'Internal server error' },
    })

    // Act
    const result = await tenfastAdapter.getOrCreateAndUpdateTenant(contact)

    // Assert
    expect(result).toEqual({ ok: false, err: 'could-not-retrieve-tenant' })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('should return error when PATCH update fails', async () => {
    // Arrange
    const contact = factory.contact.build()
    const existingTenant = factory.tenfastTenant.build({
      externalId: contact.contactCode,
    })

    // First call: getTenantByContactCode → found
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: { records: [existingTenant] },
    })

    // Second call: PATCH to update tenant → failure
    ;(request as jest.Mock).mockResolvedValueOnce({
      status: 500,
      data: { error: 'Internal server error' },
    })

    // Act
    const result = await tenfastAdapter.getOrCreateAndUpdateTenant(contact)

    // Assert
    expect(result).toEqual({ ok: false, err: 'could-not-update-tenant' })
    expect(request).toHaveBeenCalledTimes(2)
  })
})
