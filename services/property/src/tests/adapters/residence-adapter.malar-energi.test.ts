jest.mock('../../adapters/db', () => ({
  prisma: {
    propertyStructure: { findFirst: jest.fn() },
    template: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { prisma } from '../../adapters/db'
import { upsertMalarEnergiFacilityId } from '../../adapters/residence-adapter'

type MockedPrisma = {
  propertyStructure: { findFirst: jest.Mock }
  template: { findMany: jest.Mock }
  $transaction: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma

const RENTAL_ID = '307-040-01-0101'
const RESIDENCE_ID = '_0J415BPTR'
const TEMPLATE_ID = '_40X0NMANBT2TMK'
const VALUE = '735999137000348729'

const rawText = (call: unknown[]): string =>
  (call[0] as string[]).join('').trim()

// tx exposes typeText.updateMany (Prisma) + $executeRaw (raw INSERT). updateMany
// resolves to { count } to drive the update-or-insert branch.
const makeTx = (updatedCount: number) => ({
  typeText: {
    updateMany: jest.fn().mockResolvedValue({ count: updatedCount }),
  },
  $executeRaw: jest.fn().mockResolvedValue(undefined),
})

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

  it('returns template-not-found when no Anläggningsid template exists', async () => {
    mockPrisma.propertyStructure.findFirst.mockResolvedValue({
      timestamp: '0000000001',
      propertyObject: { residence: { id: RESIDENCE_ID } },
    })
    mockPrisma.template.findMany.mockResolvedValue([])

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: false, err: 'template-not-found' })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('updates existing comment row(s) without inserting, across all templates', async () => {
    mockPrisma.propertyStructure.findFirst.mockResolvedValue({
      timestamp: '0000000001',
      propertyObject: { residence: { id: RESIDENCE_ID } },
    })
    // Two matching templates — the residence's comment may be under either.
    mockPrisma.template.findMany.mockResolvedValue([
      { id: TEMPLATE_ID },
      { id: '_OTHERTEMPLATE' },
    ])
    const tx = makeTx(1)
    mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: true, data: VALUE })
    expect(tx.typeText.updateMany).toHaveBeenCalledWith({
      where: {
        keycode: RESIDENCE_ID,
        keycmtep: { in: [TEMPLATE_ID, '_OTHERTEMPLATE'] },
      },
      data: { text: VALUE },
    })
    // No insert when an existing row was updated.
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('inserts a new comment row when none exists (update count 0)', async () => {
    mockPrisma.propertyStructure.findFirst.mockResolvedValue({
      timestamp: '0000000001',
      propertyObject: { residence: { id: RESIDENCE_ID } },
    })
    mockPrisma.template.findMany.mockResolvedValue([{ id: TEMPLATE_ID }])
    const tx = makeTx(0)
    mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: true, data: VALUE })
    expect(tx.typeText.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(rawText(tx.$executeRaw.mock.calls[0])).toContain('INSERT INTO cmtex')
  })

  it('returns unknown when a database error is thrown', async () => {
    mockPrisma.propertyStructure.findFirst.mockRejectedValue(new Error('boom'))

    const result = await upsertMalarEnergiFacilityId(RENTAL_ID, VALUE)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
