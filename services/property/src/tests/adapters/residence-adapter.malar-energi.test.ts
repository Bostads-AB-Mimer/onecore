jest.mock('../../adapters/db', () => ({
  prisma: {
    propertyStructure: { findFirst: jest.fn() },
    template: { findFirst: jest.fn() },
    typeText: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { prisma } from '../../adapters/db'
import { upsertMalarEnergiFacilityId } from '../../adapters/residence-adapter'

type MockedPrisma = {
  propertyStructure: { findFirst: jest.Mock }
  template: { findFirst: jest.Mock }
  typeText: { findFirst: jest.Mock }
  $transaction: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma

const RENTAL_ID = '307-040-01-0101'
const RESIDENCE_ID = '_0J415BPTR'
const TEMPLATE_ID = '_40X0NMANBT2TMK'
const VALUE = '735999137000348729'

const rawText = (call: unknown[]): string =>
  (call[0] as string[]).join('').trim()

describe('residence-adapter.upsertMalarEnergiFacilityId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns residence-not-found when the rentalId resolves to no residence', async () => {
    mockPrisma.propertyStructure.findFirst.mockResolvedValue(null)

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: false, err: 'residence-not-found' })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns template-not-found when the Anläggningsid template is missing', async () => {
    mockPrisma.propertyStructure.findFirst.mockResolvedValue({
      residenceId: RESIDENCE_ID,
      timestamp: '0000000001',
    })
    mockPrisma.template.findFirst.mockResolvedValue(null)

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: false, err: 'template-not-found' })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('updates the existing comment row when one exists', async () => {
    mockPrisma.propertyStructure.findFirst.mockResolvedValue({
      residenceId: RESIDENCE_ID,
      timestamp: '0000000001',
    })
    mockPrisma.template.findFirst.mockResolvedValue({ id: TEMPLATE_ID })
    mockPrisma.typeText.findFirst.mockResolvedValue({ id: '_EXISTING' })
    const tx = { $executeRaw: jest.fn().mockResolvedValue(undefined) }
    mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: true, data: VALUE })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(rawText(tx.$executeRaw.mock.calls[0])).toContain('UPDATE cmtex')
  })

  it('inserts a new comment row when none exists', async () => {
    mockPrisma.propertyStructure.findFirst.mockResolvedValue({
      residenceId: RESIDENCE_ID,
      timestamp: '0000000001',
    })
    mockPrisma.template.findFirst.mockResolvedValue({ id: TEMPLATE_ID })
    mockPrisma.typeText.findFirst.mockResolvedValue(null)
    const tx = { $executeRaw: jest.fn().mockResolvedValue(undefined) }
    mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: true, data: VALUE })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(rawText(tx.$executeRaw.mock.calls[0])).toContain('INSERT INTO cmtex')
  })

  it('returns unknown when a database error is thrown', async () => {
    mockPrisma.propertyStructure.findFirst.mockRejectedValue(new Error('boom'))

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
