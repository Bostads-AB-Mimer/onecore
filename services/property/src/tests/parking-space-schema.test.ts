import { ParkingSpaceSchema } from '../types/parking-space'

// Regression: rental id 705-021-99-0003 has a null platsnr in Xpand, which made
// the by-rental-id route throw a ZodError and return 500.
const parkingSpace = {
  rentalId: '705-021-99-0003',
  companyCode: '001',
  companyName: 'Mimer',
  managementUnitCode: '705',
  managementUnitName: 'Förvaltningsområde',
  propertyCode: '705-021',
  propertyName: 'Fastighet',
  buildingCode: null,
  buildingName: null,
  parkingSpace: {
    propertyObjectId: '_0CE0AJPQV',
    code: 'P123',
    name: 'Parkeringsplats',
    parkingNumber: null,
    parkingSpaceType: {
      code: 'PPLATS',
      name: 'Parkeringsplats utan el',
    },
  },
  address: {
    streetAddress: 'Gatan 1',
    streetAddress2: null,
    postalCode: '72000',
    city: 'Västerås',
  },
}

describe('ParkingSpaceSchema', () => {
  it('accepts a parking space without a parking number', () => {
    expect(ParkingSpaceSchema.safeParse(parkingSpace).success).toBe(true)
  })

  it('accepts a missing address as null rather than an empty object', () => {
    expect(
      ParkingSpaceSchema.safeParse({ ...parkingSpace, address: null }).success
    ).toBe(true)
    expect(
      ParkingSpaceSchema.safeParse({ ...parkingSpace, address: {} }).success
    ).toBe(false)
  })

  it('still requires the non-nullable parking space columns', () => {
    const result = ParkingSpaceSchema.safeParse({
      ...parkingSpace,
      parkingSpace: { ...parkingSpace.parkingSpace, code: null },
    })

    expect(result.success).toBe(false)
  })
})
