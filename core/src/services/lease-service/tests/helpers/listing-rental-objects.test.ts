import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import {
  getRentalObjectForListing,
  getRentalObjectsForListings,
  withRentalObjects,
} from '../../helpers/listing-rental-objects'
import * as factory from '../../../../../test/factories'

beforeEach(jest.resetAllMocks)

const parking = (rentalObjectCode: string) => ({
  rentalObjectCode,
  listingCategory: 'PARKING_SPACE' as const,
})
const apartment = (rentalObjectCode: string) => ({
  rentalObjectCode,
  listingCategory: 'APARTMENT' as const,
})

describe(getRentalObjectsForListings, () => {
  it('fetches each category with its own codes and merges the results', async () => {
    const parkingSpy = jest
      .spyOn(leasingAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({
        ok: true,
        data: [factory.rentalObject.build({ rentalObjectCode: 'P1' })],
      })
    const apartmentSpy = jest
      .spyOn(leasingAdapter, 'getApartments')
      .mockResolvedValueOnce({
        ok: true,
        data: [factory.rentalObject.build({ rentalObjectCode: 'A1' })],
      })

    const result = await getRentalObjectsForListings([
      parking('P1'),
      apartment('A1'),
      apartment('A1'),
    ])

    expect(parkingSpy).toHaveBeenCalledWith(['P1'])
    expect(apartmentSpy).toHaveBeenCalledWith(['A1'])
    expect(result.ok && [...result.data.keys()]).toEqual(['P1', 'A1'])
  })

  it('does not call a lookup for a category no listing has', async () => {
    // getParkingSpaces without codes would return every parking space
    const parkingSpy = jest.spyOn(leasingAdapter, 'getParkingSpaces')
    jest
      .spyOn(leasingAdapter, 'getApartments')
      .mockResolvedValueOnce({ ok: true, data: [] })

    await getRentalObjectsForListings([apartment('A1')])
    const empty = await getRentalObjectsForListings([])

    expect(parkingSpy).not.toHaveBeenCalled()
    expect(empty).toEqual({ ok: true, data: new Map() })
  })

  it('treats a category with no matches as empty, keeping the others', async () => {
    jest.spyOn(leasingAdapter, 'getParkingSpaces').mockResolvedValueOnce({
      ok: true,
      data: [factory.rentalObject.build({ rentalObjectCode: 'P1' })],
    })
    jest
      .spyOn(leasingAdapter, 'getApartments')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await getRentalObjectsForListings([
      parking('P1'),
      apartment('A1'),
    ])

    expect(result.ok && [...result.data.keys()]).toEqual(['P1'])
  })

  it('fails when a lookup fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [] })
    jest
      .spyOn(leasingAdapter, 'getApartments')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await getRentalObjectsForListings([
      parking('P1'),
      apartment('A1'),
    ])

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(getRentalObjectForListing, () => {
  it('uses the apartment lookup for an apartment listing', async () => {
    const apartmentSpy = jest
      .spyOn(leasingAdapter, 'getApartmentByCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.rentalObject.build({ rentalObjectCode: 'A1' }),
      })
    const parkingSpy = jest.spyOn(leasingAdapter, 'getParkingSpaceByCode')

    const result = await getRentalObjectForListing(apartment('A1'))

    expect(result.ok).toBe(true)
    expect(apartmentSpy).toHaveBeenCalledWith('A1')
    expect(parkingSpy).not.toHaveBeenCalled()
  })

  it('finds nothing for a category without a lookup', async () => {
    const result = await getRentalObjectForListing({
      rentalObjectCode: 'S1',
      listingCategory: 'STORAGE',
    })

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })
})

describe(withRentalObjects, () => {
  it('attaches rental objects and leaves out listings without one', () => {
    const rentalObject = factory.rentalObject.build({ rentalObjectCode: 'A1' })

    const result = withRentalObjects(
      [apartment('A1'), apartment('A2')],
      new Map([['A1', rentalObject]])
    )

    expect(result).toEqual([{ ...apartment('A1'), rentalObject }])
  })
})
