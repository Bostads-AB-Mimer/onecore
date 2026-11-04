jest.mock('../../adapters/db', () => ({
  prisma: {
    onecoreKvvArea: { findUnique: jest.fn() },
  },
}))
// Every code is operating stock unless listed as sold; dedupes like the real one.
const sold = new Set<string>()
jest.mock('../../adapters/company-scope', () => ({
  filterToOperatingCompanies: (codes: string[]) =>
    Promise.resolve(Array.from(new Set(codes)).filter((c) => !sold.has(c))),
}))
jest.mock('../../adapters/kvv-area-adapter', () => ({
  getKvvAreaExceptions: jest.fn(),
}))
jest.mock('../../adapters/cost-center-adapter', () => ({
  fetchCostCenterMembership: jest.fn(),
}))
jest.mock('../../adapters/rental-object-adapter', () => ({
  resolveStructurePropertyCodes: jest.fn().mockResolvedValue([]),
}))

import { prisma } from '../../adapters/db'
import { getKvvAreaExceptions } from '../../adapters/kvv-area-adapter'
import {
  resolveDetailsPropertyCodes,
  resolveSearchScope,
} from '../../adapters/property-grouping-adapter'

type MockedPrisma = {
  onecoreKvvArea: { findUnique: jest.Mock }
}
const mockPrisma = prisma as unknown as MockedPrisma
const mockExceptions = getKvvAreaExceptions as jest.Mock

const AREA_VALLBY = '22222222-2222-2222-2222-222222222222'
const AREA_STUDENT = '44444444-4444-4444-4444-444444444444'

const exception = {
  kvvAreaId: AREA_STUDENT,
  propertyCode: '06601',
  code: '307-048',
}

beforeEach(() => {
  jest.clearAllMocks()
  sold.clear()
  mockPrisma.onecoreKvvArea.findUnique.mockImplementation(
    ({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === AREA_VALLBY
          ? { id: AREA_VALLBY, propertyLinks: [{ propertyCode: '06601' }] }
          : { id: AREA_STUDENT, propertyLinks: [] }
      )
  )
  mockExceptions.mockResolvedValue([exception])
})

describe('property-grouping-adapter.resolveSearchScope', () => {
  it('resolves a KVV-area to its default-side share of a split property', async () => {
    const scope = await resolveSearchScope({ kvvAreaIds: [AREA_VALLBY] })

    expect(scope).toEqual({
      propertyCodes: [],
      partialProperties: [
        { propertyCode: '06601', excludedBuildingCodes: ['307-048'] },
      ],
      buildingCodes: [],
    })
  })

  it('resolves a KVV-area to the buildings excepted into it', async () => {
    const scope = await resolveSearchScope({ kvvAreaIds: [AREA_STUDENT] })

    expect(scope).toEqual({
      propertyCodes: [],
      partialProperties: [],
      buildingCodes: ['307-048'],
    })
  })

  it('resolves a propertyShares value to that area share only', async () => {
    const scope = await resolveSearchScope({
      propertyShares: [`${AREA_STUDENT}:06601`],
    })

    expect(scope.buildingCodes).toEqual(['307-048'])
    expect(scope.partialProperties).toEqual([])
    expect(scope.propertyCodes).toEqual([])
  })

  it('drops the partial form of a property that is no longer operating stock', async () => {
    sold.add('06601')

    const scope = await resolveSearchScope({ kvvAreaIds: [AREA_VALLBY] })

    expect(scope).toEqual({
      propertyCodes: [],
      partialProperties: [],
      buildingCodes: [],
    })
  })

  it('resolves an area once when it is named both whole and as a share', async () => {
    const scope = await resolveSearchScope({
      kvvAreaIds: [AREA_STUDENT],
      propertyShares: [`${AREA_STUDENT}:06601`],
    })

    expect(mockPrisma.onecoreKvvArea.findUnique).toHaveBeenCalledTimes(1)
    expect(scope.buildingCodes).toEqual(['307-048'])
  })

  it('lets a whole property named directly override its partial form', async () => {
    const scope = await resolveSearchScope({
      kvvAreaIds: [AREA_VALLBY],
      propertyCodes: ['06601'],
    })

    expect(scope.propertyCodes).toEqual(['06601'])
    expect(scope.partialProperties).toEqual([])
  })
})

describe('property-grouping-adapter.resolveDetailsPropertyCodes', () => {
  it('widens a share to its whole fastighet', async () => {
    const codes = await resolveDetailsPropertyCodes({
      propertyShares: [`${AREA_STUDENT}:06601`],
    })

    expect(codes).toEqual(['06601'])
  })
})
