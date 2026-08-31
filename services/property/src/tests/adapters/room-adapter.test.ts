jest.mock('../../adapters/db', () => ({
  prisma: {
    room: { findUnique: jest.fn() },
    componentInstallations: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { prisma } from '../../adapters/db'
import {
  deleteRoom,
  RoomHasComponentsError,
  RoomNotFoundError,
} from '../../adapters/room-adapter'

type MockedPrisma = {
  room: { findUnique: jest.Mock }
  componentInstallations: { findFirst: jest.Mock }
  $transaction: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma

describe('room-adapter.deleteRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws RoomNotFoundError when the room is missing', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(null)

    await expect(deleteRoom('MISSING')).rejects.toBeInstanceOf(
      RoomNotFoundError
    )
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('throws RoomHasComponentsError when an active installation exists', async () => {
    mockPrisma.room.findUnique.mockResolvedValue({
      id: 'ROOM-1',
      propertyObjectId: 'CMOBJ-1',
    })
    // $transaction(callback) invokes callback with a tx that exposes the
    // same mocked componentInstallations.
    const tx = {
      componentInstallations: { findFirst: jest.fn() },
      $executeRaw: jest.fn(),
    }
    tx.componentInstallations.findFirst.mockResolvedValue({ id: 'INST-1' })
    mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

    await expect(deleteRoom('ROOM-1')).rejects.toBeInstanceOf(
      RoomHasComponentsError
    )
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('runs the three deletes when no active installations exist', async () => {
    mockPrisma.room.findUnique.mockResolvedValue({
      id: 'ROOM-1',
      propertyObjectId: 'CMOBJ-1',
    })
    const tx = {
      componentInstallations: { findFirst: jest.fn() },
      $executeRaw: jest.fn(),
    }
    tx.componentInstallations.findFirst.mockResolvedValue(null)
    tx.$executeRaw.mockResolvedValue(undefined)
    mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

    await deleteRoom('ROOM-1')

    expect(tx.componentInstallations.findFirst).toHaveBeenCalledWith({
      where: { spaceId: 'CMOBJ-1', deinstallationDate: null },
      select: { id: true },
    })
    // babuf → barum → cmobj, in FK-safe order
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3)
  })
})
