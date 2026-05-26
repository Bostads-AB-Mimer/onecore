import { prisma } from '../db'
import { findKvvAreaCodesByResponsibles } from '../kvv-area-adapter'

describe('kvv-area-adapter.findKvvAreaCodesByResponsibles', () => {
  beforeEach(async () => {
    await prisma.onecorePropertyKvvArea.deleteMany()
    await prisma.onecoreKvvArea.deleteMany()
    await prisma.onecoreCostCenter.deleteMany()
  })

  it('returns codes of kvv areas whose responsibleKeycloakUserId is in the list', async () => {
    const cc = await prisma.onecoreCostCenter.create({
      data: { code: 'CC1', name: 'CC1' },
    })
    await prisma.onecoreKvvArea.createMany({
      data: [
        { code: 'A1', costCenterId: cc.id, responsibleKeycloakUserId: 'u1' },
        { code: 'A2', costCenterId: cc.id, responsibleKeycloakUserId: 'u2' },
        { code: 'A3', costCenterId: cc.id, responsibleKeycloakUserId: null },
      ],
    })

    const codes = await findKvvAreaCodesByResponsibles(['u1', 'u2'])
    expect(codes.sort()).toEqual(['A1', 'A2'])
  })

  it('returns [] for empty input', async () => {
    expect(await findKvvAreaCodesByResponsibles([])).toEqual([])
  })

  it('returns [] when no kvv areas match', async () => {
    const codes = await findKvvAreaCodesByResponsibles(['nobody'])
    expect(codes).toEqual([])
  })
})
