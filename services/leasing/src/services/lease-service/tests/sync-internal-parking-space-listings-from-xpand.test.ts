import assert from 'node:assert'

import { db, migrate, teardown } from '../adapters/db'
import * as service from '../sync-internal-parking-space-listings-from-xpand'
import * as xpandSoapAdapter from '../adapters/xpand/xpand-soap-adapter'
import * as leaseAdapter from '../adapters/xpand/tenant-lease-adapter'
import * as factories from './factories'

const getResidentialAreaSpy = jest.spyOn(
  leaseAdapter,
  'getResidentialAreaByRentalPropertyId'
)

describe(service.parseInternalParkingSpacesToInsertableListings, () => {
  it('if parking space missing PublishedTo, returns it as invalid', () => {
    const valid = factories.soapInternalParkingSpace.build({
      RentalObjectCode: '2',
    })

    const invalid = factories.soapInternalParkingSpace.build({
      RentalObjectCode: '1',
      PublishedTo: undefined,
    })

    const result = service.parseInternalParkingSpacesToInsertableListings([
      valid,
      invalid,
    ])

    expect(result).toEqual({
      ok: [
        expect.objectContaining({ rentalObjectCode: valid.RentalObjectCode }),
      ],
      invalid: [
        {
          rentalObjectCode: invalid.RentalObjectCode,
          errors: [{ code: 'invalid_date', path: 'PublishedTo' }],
        },
      ],
    })
  })
})

describe(service.syncInternalParkingSpaces, () => {
  beforeAll(async () => {
    await migrate()
  })

  afterEach(async () => {
    await db('listing').del()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    await teardown()
  })

  it('inserts parking spaces as listings', async () => {
    getResidentialAreaSpy.mockResolvedValue({
      ok: true,
      data: { code: 'foo', caption: 'bar' },
    })

    const internalParkingSpaceMocks =
      factories.soapInternalParkingSpace.buildList(10)
    const soapSpy = jest
      .spyOn(xpandSoapAdapter, 'getPublishedInternalParkingSpaces')
      .mockResolvedValueOnce({
        ok: true,
        data: internalParkingSpaceMocks,
      })

    const result = await service.syncInternalParkingSpaces()

    expect(soapSpy).toHaveBeenCalledTimes(1)
    assert(result.ok)
    expect(result.data.insertions.failed).toHaveLength(0)
    expect(result.data.insertions.inserted).toHaveLength(
      internalParkingSpaceMocks.length
    )

    const insertedListings = (
      await db('listing').select('rentalObjectCode')
    ).map((v) => v.rentalObjectCode)

    expect(insertedListings.length).toEqual(internalParkingSpaceMocks.length)
  })

  it('fails with error if fail to patch with residential data', async () => {
    getResidentialAreaSpy.mockRejectedValue({
      ok: false,
      err: null,
    })

    const internalParkingSpaceMocks =
      factories.soapInternalParkingSpace.buildList(10)

    const soapSpy = jest
      .spyOn(xpandSoapAdapter, 'getPublishedInternalParkingSpaces')
      .mockResolvedValueOnce({
        ok: true,
        data: internalParkingSpaceMocks,
      })

    const result = await service.syncInternalParkingSpaces()

    expect(soapSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: false, err: 'get-residential-area' })
  })

  it('fails gracefully on duplicates and invalid entries and inserts the rest', async () => {
    getResidentialAreaSpy.mockResolvedValue({
      ok: true,
      data: { code: 'foo', caption: 'bar' },
    })

    const valid_1 = factories.soapInternalParkingSpace.build({
      RentalObjectCode: '1',
    })
    const valid_2 = factories.soapInternalParkingSpace.build({
      RentalObjectCode: '2',
    })
    const valid_2_duplicate = factories.soapInternalParkingSpace.build({
      RentalObjectCode: '2',
    })
    const invalid = factories.soapInternalParkingSpace.build({
      RentalObjectCode: '3',
      PublishedTo: 'not a date',
    })

    const internalParkingSpaces = [valid_1, valid_2, valid_2_duplicate, invalid]
    const soapSpy = jest
      .spyOn(xpandSoapAdapter, 'getPublishedInternalParkingSpaces')
      .mockResolvedValueOnce({
        ok: true,
        data: internalParkingSpaces,
      })

    const result = await service.syncInternalParkingSpaces()

    expect(soapSpy).toHaveBeenCalledTimes(1)

    expect(result).toEqual({
      ok: true,
      data: {
        invalid: [
          expect.objectContaining({
            rentalObjectCode: '3',
            errors: [{ code: 'invalid_date', path: 'PublishedTo' }],
          }),
        ],
        insertions: {
          failed: [
            expect.objectContaining({
              err: 'conflict-active-listing',
              listing: expect.objectContaining({ rentalObjectCode: '2' }),
            }),
          ],
          inserted: expect.arrayContaining([
            expect.objectContaining({ rentalObjectCode: '1' }),
            expect.objectContaining({ rentalObjectCode: '2' }),
          ]),
        },
      },
    })

    const insertedListings = await db('listing').select('rentalObjectCode')

    expect(insertedListings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rentalObjectCode: '1' }),
        expect.objectContaining({ rentalObjectCode: '2' }),
      ])
    )
  })
})
