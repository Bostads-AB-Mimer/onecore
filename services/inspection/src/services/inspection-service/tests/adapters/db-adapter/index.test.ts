import { Knex } from 'knex'
import * as dbAdapter from '../../../adapters/db-adapter'
import {
  CreateInspectionSchema,
  UpdateInspectionStatusSchema,
  validateStatusTransition,
} from '../../../adapters/db-adapter/schemas'
import { DbInspectionRoom } from '../../../adapters/db-adapter/types'
import {
  CreateInspectionParamsFactory,
  DbInspectionFactory,
  DbInspectionRoomFactory,
} from '../../factories/inspection'

jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}))

let nextInspectionId = 1
let nextRoomId = 1
let nextRemarkId = 1

function createMockTrx() {
  let insertData: Record<string, unknown> = {}
  let tableName = ''

  const chain = {
    insert(data: Record<string, unknown>) {
      insertData = data
      return chain
    },
    into(table: string) {
      tableName = table
      return chain
    },
    returning(_columns: string) {
      if (tableName === 'inspection') {
        return Promise.resolve([
          {
            ...insertData,
            id: nextInspectionId++,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
      }
      if (tableName === 'inspection_room') {
        return Promise.resolve([
          {
            ...insertData,
            id: nextRoomId++,
            createdAt: new Date(),
          },
        ])
      }
      if (tableName === 'inspection_remark') {
        return Promise.resolve([
          {
            ...insertData,
            id: nextRemarkId++,
            createdAt: new Date(),
          },
        ])
      }
      return Promise.resolve([insertData])
    },
  }

  return chain
}

function createMockDb() {
  const mockTrx = createMockTrx()

  return {
    transaction: jest.fn((callback) => callback(mockTrx)),
  } as unknown as Knex
}

describe('db-adapter', () => {
  beforeEach(() => {
    nextInspectionId = 1
    nextRoomId = 1
    nextRemarkId = 1
  })

  describe('createInspection', () => {
    it('creates an inspection with rooms and remarks', async () => {
      const mockDb = createMockDb()
      const params = CreateInspectionParamsFactory.build({
        rooms: [
          {
            room: 'Kitchen',
            remarks: [
              {
                remarkId: 'R1',
                location: 'Kitchen sink',
                buildingComponent: 'Sink',
                notes: 'Minor scratch',
                remarkGrade: 1,
                remarkStatus: 'Open',
                cost: 200,
                invoice: false,
                quantity: 1,
                isMissing: false,
                fixedDate: null,
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
          {
            room: 'Bedroom',
            remarks: [
              {
                remarkId: 'R2',
                location: 'Window',
                buildingComponent: 'Window frame',
                notes: 'Damaged frame',
                remarkGrade: 3,
                remarkStatus: 'Open',
                cost: 500,
                invoice: true,
                quantity: 1,
                isMissing: false,
                fixedDate: null,
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
        ],
      })

      const result = await dbAdapter.createInspection(mockDb, params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.id).toBeDefined()
        expect(result.data.status).toBe(params.status)
        expect(result.data.inspector).toBe(params.inspector)
        expect(result.data.residenceId).toBe(params.residenceId)
        expect(result.data.rooms).toHaveLength(2)
        expect(result.data.rooms[0].room).toBe('Kitchen')
        expect(result.data.rooms[0].remarks).toHaveLength(1)
        expect(result.data.rooms[1].room).toBe('Bedroom')
        expect(result.data.rooms[1].remarks).toHaveLength(1)
      }
    })

    it('calculates remarkCount correctly', async () => {
      const mockDb = createMockDb()
      const params = CreateInspectionParamsFactory.build({
        rooms: [
          {
            room: 'Living Room',
            remarks: [
              {
                remarkId: 'R1',
                location: 'Wall',
                buildingComponent: 'Paint',
                notes: 'Needs repainting',
                remarkGrade: 2,
                remarkStatus: 'Open',
                cost: 300,
                invoice: false,
                quantity: 1,
                isMissing: false,
                fixedDate: null,
                workOrderCreated: false,
                workOrderStatus: null,
              },
              {
                remarkId: 'R2',
                location: 'Floor',
                buildingComponent: 'Flooring',
                notes: 'Scratches',
                remarkGrade: 1,
                remarkStatus: 'Open',
                cost: 100,
                invoice: false,
                quantity: 1,
                isMissing: false,
                fixedDate: null,
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
          {
            room: 'Bathroom',
            remarks: [
              {
                remarkId: 'R3',
                location: 'Shower',
                buildingComponent: 'Tiles',
                notes: 'Cracked tile',
                remarkGrade: 3,
                remarkStatus: 'Open',
                cost: 400,
                invoice: true,
                quantity: 1,
                isMissing: false,
                fixedDate: null,
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
        ],
      })

      const result = await dbAdapter.createInspection(mockDb, params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.remarkCount).toBe(3)
      }
    })

    it('creates inspection with no remarks', async () => {
      const mockDb = createMockDb()
      const params = CreateInspectionParamsFactory.build({
        hasRemarks: false,
        rooms: [
          {
            room: 'Kitchen',
            remarks: [],
          },
        ],
      })

      const result = await dbAdapter.createInspection(mockDb, params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.remarkCount).toBe(0)
        expect(result.data.hasRemarks).toBe(false)
        expect(result.data.rooms).toHaveLength(1)
        expect(result.data.rooms[0].remarks).toHaveLength(0)
      }
    })

    it('creates inspection with nullable fields', async () => {
      const mockDb = createMockDb()
      const params = CreateInspectionParamsFactory.build({
        apartmentCode: null,
        startedAt: null,
        endedAt: null,
        masterKeyAccess: null,
        notes: null,
        totalCost: null,
      })

      const result = await dbAdapter.createInspection(mockDb, params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.apartmentCode).toBeNull()
        expect(result.data.startedAt).toBeNull()
        expect(result.data.endedAt).toBeNull()
        expect(result.data.masterKeyAccess).toBeNull()
        expect(result.data.notes).toBeNull()
        expect(result.data.totalCost).toBeNull()
      }
    })

    it('handles remarks with nullable fields', async () => {
      const mockDb = createMockDb()
      const params = CreateInspectionParamsFactory.build({
        rooms: [
          {
            room: 'Kitchen',
            remarks: [
              {
                remarkId: 'R1',
                location: null,
                buildingComponent: null,
                notes: null,
                remarkGrade: 1,
                remarkStatus: null,
                cost: 0,
                invoice: false,
                quantity: 1,
                isMissing: false,
                fixedDate: null,
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
        ],
      })

      const result = await dbAdapter.createInspection(mockDb, params)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.rooms[0].remarks[0].location).toBeNull()
        expect(result.data.rooms[0].remarks[0].buildingComponent).toBeNull()
        expect(result.data.rooms[0].remarks[0].notes).toBeNull()
        expect(result.data.rooms[0].remarks[0].remarkStatus).toBeNull()
        expect(result.data.rooms[0].remarks[0].fixedDate).toBeNull()
        expect(result.data.rooms[0].remarks[0].workOrderStatus).toBeNull()
      }
    })

    it('returns error when transaction fails', async () => {
      const mockDb = {
        transaction: jest.fn(() => {
          throw new Error('DB connection failed')
        }),
      } as unknown as Knex

      const params = CreateInspectionParamsFactory.build()
      const result = await dbAdapter.createInspection(mockDb, params)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('unknown')
      }
    })

    it('validates that rooms array is required', () => {
      const params = {
        status: 'ongoing',
        date: new Date(),
        startedAt: null,
        endedAt: null,
        inspector: 'Test Inspector',
        type: 'Move-in',
        residenceId: 'RES-001',
        address: '123 Test Street',
        apartmentCode: 'APT-001',
        isFurnished: false,
        leaseId: 'LEASE-001',
        isTenantPresent: true,
        isNewTenantPresent: false,
        masterKeyAccess: 'Yes',
        hasRemarks: false,
        notes: null,
        totalCost: null,
        // rooms is intentionally missing
      }

      const result = CreateInspectionSchema.safeParse(params)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain(
          'Rooms array is required'
        )
      }
    })

    it('validates that rooms array must have at least one room', () => {
      const params = CreateInspectionParamsFactory.build({
        rooms: [], // Empty array
      })

      const result = CreateInspectionSchema.safeParse(params)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe(
          'At least one room is required for an inspection'
        )
      }
    })
  })

  describe('updateInspectionStatus', () => {
    const mockInspectionRow = {
      id: 1,
      status: 'Registrerad',
      date: new Date('2023-01-01T10:00:00Z'),
      startedAt: null,
      endedAt: null,
      inspector: 'Test Inspector',
      type: 'Move-in',
      residenceId: 'RES-001',
      address: '123 Test Street',
      apartmentCode: 'APT-001',
      isFurnished: false,
      leaseId: 'LEASE-001',
      isTenantPresent: true,
      isNewTenantPresent: false,
      masterKeyAccess: null,
      hasRemarks: false,
      notes: null,
      totalCost: null,
      remarkCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    function createMockTrxForUpdate(
      inspection: typeof mockInspectionRow | undefined,
      rooms: DbInspectionRoom[] = [],
      remarksByRoomId: Record<number, Array<Record<string, unknown>>> = {}
    ) {
      let currentOperation: 'select' | 'update' = 'select'
      let tableName = ''
      let updateData: Record<string, unknown> = {}

      const chain: Record<string, jest.Mock> = {
        select: jest.fn(() => {
          currentOperation = 'select'
          return chain
        }),
        update: jest.fn((data: Record<string, unknown>) => {
          currentOperation = 'update'
          updateData = data
          return chain
        }),
        from: jest.fn((table: string) => {
          tableName = table
          return chain
        }),
        where: jest.fn((_column: string, value: unknown) => {
          if (currentOperation === 'select') {
            if (tableName === 'inspection') {
              return Promise.resolve(inspection ? [inspection] : [])
            }
            if (tableName === 'inspection_room') {
              return Promise.resolve(rooms)
            }
            if (tableName === 'inspection_remark') {
              return Promise.resolve(remarksByRoomId[value as number] || [])
            }
            return Promise.resolve([])
          }
          return chain
        }),
        returning: jest.fn(() => {
          if (currentOperation === 'update' && tableName === 'inspection') {
            return Promise.resolve(
              inspection ? [{ ...inspection, ...updateData }] : []
            )
          }
          return Promise.resolve([])
        }),
      }

      return chain
    }

    function createMockDbForUpdate(
      inspection: typeof mockInspectionRow | undefined,
      rooms: DbInspectionRoom[] = [],
      remarksByRoomId: Record<number, Array<Record<string, unknown>>> = {}
    ) {
      const mockTrx = createMockTrxForUpdate(inspection, rooms, remarksByRoomId)

      return {
        transaction: jest.fn((callback) => callback(mockTrx)),
      } as unknown as Knex
    }

    it('updates status from Registrerad to Påbörjad', async () => {
      const mockDb = createMockDbForUpdate(mockInspectionRow, [
        {
          id: 1,
          inspectionId: 1,
          roomName: 'Kitchen',
          createdAt: new Date(),
        },
      ])

      const result = await dbAdapter.updateInspectionStatus(
        mockDb,
        '1',
        'Påbörjad'
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe('Påbörjad')
        expect(result.data.rooms).toHaveLength(1)
      }
    })

    it('updates status from Påbörjad to Genomförd', async () => {
      const inspectionInProgress = {
        ...mockInspectionRow,
        status: 'Påbörjad',
      }
      const mockDb = createMockDbForUpdate(inspectionInProgress)

      const result = await dbAdapter.updateInspectionStatus(
        mockDb,
        '1',
        'Genomförd'
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe('Genomförd')
      }
    })

    it('rejects invalid transition from Registrerad to Genomförd', async () => {
      const mockDb = createMockDbForUpdate(mockInspectionRow)

      const result = await dbAdapter.updateInspectionStatus(
        mockDb,
        '1',
        'Genomförd'
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-status-transition')
      }
    })

    it('rejects backward transition from Genomförd to Registrerad', async () => {
      const completedInspection = {
        ...mockInspectionRow,
        status: 'Genomförd',
      }
      const mockDb = createMockDbForUpdate(completedInspection)

      const result = await dbAdapter.updateInspectionStatus(
        mockDb,
        '1',
        'Registrerad'
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-status-transition')
      }
    })

    it('returns not-found when inspection does not exist', async () => {
      const mockDb = createMockDbForUpdate(undefined)

      const result = await dbAdapter.updateInspectionStatus(
        mockDb,
        '999',
        'Påbörjad'
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('not-found')
      }
    })

    it('returns error when database fails', async () => {
      const mockDb = {
        transaction: jest.fn(() => {
          throw new Error('DB connection failed')
        }),
      } as unknown as Knex

      const result = await dbAdapter.updateInspectionStatus(
        mockDb,
        '1',
        'Påbörjad'
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('unknown')
      }
    })
  })

  describe('updateInternalInspection', () => {
    const mockInspectionRow = DbInspectionFactory.build()

    function createMockTrxForInternalUpdate(
      inspection: typeof mockInspectionRow | undefined,
      rooms: DbInspectionRoom[] = [],
      remarksByRoomId: Record<number, Array<Record<string, unknown>>> = {}
    ) {
      let currentOperation: 'select' | 'update' = 'select'
      let tableName = ''
      let updateData: Record<string, unknown> = {}

      const chain: Record<string, jest.Mock> = {
        select: jest.fn(() => {
          currentOperation = 'select'
          return chain
        }),
        update: jest.fn((data: Record<string, unknown>) => {
          currentOperation = 'update'
          updateData = data
          return chain
        }),
        from: jest.fn((table: string) => {
          tableName = table
          return chain
        }),
        where: jest.fn((_column: string, value: unknown) => {
          if (currentOperation === 'select') {
            if (tableName === 'inspection') {
              return Promise.resolve(inspection ? [inspection] : [])
            }
            if (tableName === 'inspection_room') {
              return Promise.resolve(rooms)
            }
            if (tableName === 'inspection_remark') {
              return Promise.resolve(remarksByRoomId[value as number] || [])
            }
            return Promise.resolve([])
          }
          return chain
        }),
        returning: jest.fn(() => {
          if (currentOperation === 'update' && tableName === 'inspection') {
            return Promise.resolve(
              inspection ? [{ ...inspection, ...updateData }] : []
            )
          }
          return Promise.resolve([])
        }),
      }

      return chain
    }

    function createMockDbForInternalUpdate(
      inspection: typeof mockInspectionRow | undefined,
      rooms: DbInspectionRoom[] = [],
      remarksByRoomId: Record<number, Array<Record<string, unknown>>> = {}
    ) {
      const mockTrx = createMockTrxForInternalUpdate(
        inspection,
        rooms,
        remarksByRoomId
      )

      return {
        transaction: jest.fn((callback) => callback(mockTrx)),
      } as unknown as Knex
    }

    it('updates inspector only without changing status', async () => {
      const mockDb = createMockDbForInternalUpdate(mockInspectionRow, [
        DbInspectionRoomFactory.build({ inspectionId: mockInspectionRow.id }),
      ])

      const result = await dbAdapter.updateInternalInspection(mockDb, '1', {
        inspector: 'New Inspector',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.inspector).toBe('New Inspector')
        expect(result.data.status).toBe('Registrerad')
      }
    })

    it('updates both status and inspector', async () => {
      const mockDb = createMockDbForInternalUpdate(mockInspectionRow, [
        DbInspectionRoomFactory.build({ inspectionId: mockInspectionRow.id }),
      ])

      const result = await dbAdapter.updateInternalInspection(mockDb, '1', {
        status: 'Påbörjad',
        inspector: 'New Inspector',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe('Påbörjad')
        expect(result.data.inspector).toBe('New Inspector')
      }
    })

    it('returns not-found when inspection does not exist', async () => {
      const mockDb = createMockDbForInternalUpdate(undefined)

      const result = await dbAdapter.updateInternalInspection(mockDb, '999', {
        inspector: 'New Inspector',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('not-found')
      }
    })
  })

  describe('getInspections', () => {
    function createMockQueryDb(rows: Record<string, unknown>[]) {
      const chain: Record<string, jest.Mock> = {}

      chain.select = jest.fn().mockReturnValue(chain)
      chain.where = jest.fn().mockReturnValue(chain)
      chain.whereNot = jest.fn().mockReturnValue(chain)
      chain.orderBy = jest.fn().mockReturnValue(chain)
      chain.offset = jest.fn().mockReturnValue(chain)
      chain.limit = jest.fn().mockResolvedValue(rows)
      chain.clone = jest.fn().mockReturnValue(chain)
      chain.clearSelect = jest.fn().mockReturnValue(chain)
      chain.clearOrder = jest.fn().mockReturnValue(chain)
      chain.count = jest.fn().mockReturnValue(chain)
      chain.first = jest.fn().mockResolvedValue({ count: rows.length })

      const mockDb = jest.fn().mockReturnValue(chain)
      return mockDb as unknown as Knex
    }

    it('returns paginated inspections from local database', async () => {
      const mockRows = [
        {
          id: 1,
          status: 'ongoing',
          date: new Date('2024-01-01'),
          inspector: 'Inspector A',
          type: 'Move-in',
          address: '123 Main St',
          apartmentCode: 'APT001',
          leaseId: 'LEASE001',
          masterKeyAccess: null,
        },
        {
          id: 2,
          status: 'completed',
          date: new Date('2024-02-01'),
          inspector: 'Inspector B',
          type: 'Move-out',
          address: '456 Oak Ave',
          apartmentCode: null,
          leaseId: 'LEASE002',
          masterKeyAccess: 'Key A',
        },
      ]
      const mockDb = createMockQueryDb(mockRows)

      const result = await dbAdapter.getInspections(mockDb)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.inspections).toHaveLength(2)
        expect(result.data.totalRecords).toBe(2)
        expect(result.data.inspections[0].id).toBe('1')
        expect(result.data.inspections[1].id).toBe('2')
      }
    })

    it('returns empty results when no inspections found', async () => {
      const mockDb = createMockQueryDb([])

      const result = await dbAdapter.getInspections(mockDb)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.inspections).toHaveLength(0)
        expect(result.data.totalRecords).toBe(0)
      }
    })

    it('returns error when database query fails', async () => {
      const mockDb = jest.fn().mockImplementation(() => {
        throw new Error('DB connection failed')
      }) as unknown as Knex

      const result = await dbAdapter.getInspections(mockDb)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('unknown')
      }
    })
  })

  describe('validateStatusTransition', () => {
    it('allows Registrerad to Påbörjad', () => {
      const result = validateStatusTransition('Registrerad', 'Påbörjad')
      expect(result.ok).toBe(true)
    })

    it('allows Påbörjad to Genomförd', () => {
      const result = validateStatusTransition('Påbörjad', 'Genomförd')
      expect(result.ok).toBe(true)
    })

    it('rejects Registrerad to Genomförd', () => {
      const result = validateStatusTransition('Registrerad', 'Genomförd')
      expect(result.ok).toBe(false)
    })

    it('rejects Genomförd to Registrerad', () => {
      const result = validateStatusTransition('Genomförd', 'Registrerad')
      expect(result.ok).toBe(false)
    })

    it('rejects Genomförd to Påbörjad', () => {
      const result = validateStatusTransition('Genomförd', 'Påbörjad')
      expect(result.ok).toBe(false)
    })

    it('rejects same status transition', () => {
      const result = validateStatusTransition('Registrerad', 'Registrerad')
      expect(result.ok).toBe(false)
    })
  })

  describe('UpdateInspectionStatusSchema', () => {
    it('accepts valid status', () => {
      const result = UpdateInspectionStatusSchema.safeParse({
        status: 'Påbörjad',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = UpdateInspectionStatusSchema.safeParse({
        status: 'InvalidStatus',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing status', () => {
      const result = UpdateInspectionStatusSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('getInspectionsByResidenceId', () => {
    function createMockQueryDb(rows: Record<string, unknown>[]) {
      const chain: Record<string, jest.Mock> = {}

      chain.select = jest.fn().mockReturnValue(chain)
      chain.where = jest.fn().mockReturnValue(chain)
      chain.whereNot = jest.fn().mockReturnValue(chain)
      chain.orderBy = jest.fn().mockResolvedValue(rows)

      const mockDb = jest.fn().mockReturnValue(chain)
      return mockDb as unknown as Knex
    }

    it('returns inspections for a specific residence', async () => {
      const mockRows = [
        {
          id: 1,
          status: 'ongoing',
          date: new Date('2024-01-01'),
          inspector: 'Inspector A',
          type: 'Move-in',
          address: '123 Main St',
          apartmentCode: 'APT001',
          leaseId: 'LEASE001',
          masterKeyAccess: null,
        },
      ]
      const mockDb = createMockQueryDb(mockRows)

      const result = await dbAdapter.getInspectionsByResidenceId(
        mockDb,
        'RES001'
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe('1')
      }
    })

    it('returns empty results when no inspections found', async () => {
      const mockDb = createMockQueryDb([])

      const result = await dbAdapter.getInspectionsByResidenceId(
        mockDb,
        'RES001'
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(0)
      }
    })

    it('returns error when database query fails', async () => {
      const mockDb = jest.fn().mockImplementation(() => {
        throw new Error('DB connection failed')
      }) as unknown as Knex

      const result = await dbAdapter.getInspectionsByResidenceId(
        mockDb,
        'RES001'
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('unknown')
      }
    })
  })

  describe('saveInspectionDraft', () => {
    const mockDraftParams = {
      inspectorName: 'Test Inspector',
      rooms: [
        {
          roomId: 'room-1',
          conditions: {
            wall1: 'good',
            wall2: 'good',
            wall3: 'good',
            wall4: 'good',
            floor: 'good',
            ceiling: 'good',
            details: '',
          },
          actions: {
            wall1: [],
            wall2: [],
            wall3: [],
            wall4: [],
            floor: [],
            ceiling: [],
            details: [],
          },
          componentNotes: {
            wall1: '',
            wall2: '',
            wall3: '',
            wall4: '',
            floor: '',
            ceiling: '',
            details: '',
          },
          componentPhotos: {
            wall1: [],
            wall2: [],
            wall3: [],
            wall4: [],
            floor: [],
            ceiling: [],
            details: [],
          },
          photos: [],
          isApproved: false,
          isHandled: true,
        },
      ],
    }

    function createMockDbForDraft(inspectionExists: boolean) {
      const chain: Record<string, jest.Mock> = {}
      chain.select = jest.fn().mockReturnValue(chain)
      chain.from = jest.fn().mockReturnValue(chain)
      chain.where = jest
        .fn()
        .mockResolvedValueOnce(inspectionExists ? [{ id: '1' }] : [])
        .mockReturnValue(chain)
      chain.update = jest.fn().mockResolvedValue(1)

      const mockDb = jest.fn().mockReturnValue(chain)
      // Also support dbConnection.select(...) pattern
      Object.assign(mockDb, chain)
      return mockDb as unknown as Knex
    }

    it('saves draft successfully for existing inspection', async () => {
      const mockDb = createMockDbForDraft(true)

      const result = await dbAdapter.saveInspectionDraft(
        mockDb,
        '1',
        mockDraftParams
      )

      expect(result.ok).toBe(true)
    })

    it('returns not-found when inspection does not exist', async () => {
      const mockDb = createMockDbForDraft(false)

      const result = await dbAdapter.saveInspectionDraft(
        mockDb,
        '999',
        mockDraftParams
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('not-found')
      }
    })

    it('returns error when database fails', async () => {
      const chain: Record<string, jest.Mock> = {}
      chain.select = jest.fn().mockImplementation(() => {
        throw new Error('DB connection failed')
      })
      chain.from = jest.fn().mockReturnValue(chain)
      chain.where = jest.fn().mockReturnValue(chain)

      const mockDb = Object.assign(
        jest.fn().mockReturnValue(chain),
        chain
      ) as unknown as Knex

      const result = await dbAdapter.saveInspectionDraft(
        mockDb,
        '1',
        mockDraftParams
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('unknown')
      }
    })
  })

  describe('getInspectionById', () => {
    function createMockDbForGetById(
      inspection: Record<string, unknown> | undefined
    ) {
      const chain: Record<string, jest.Mock> = {}
      chain.select = jest.fn().mockReturnValue(chain)
      chain.from = jest.fn().mockReturnValue(chain)
      chain.where = jest.fn().mockResolvedValue(inspection ? [inspection] : [])

      const mockDb = Object.assign(
        jest.fn().mockReturnValue(chain),
        chain
      ) as unknown as Knex
      return mockDb
    }

    it('returns inspection with parsed draft rooms', async () => {
      const draftRooms = [
        {
          roomId: 'room-1',
          conditions: {
            wall1: 'good',
            wall2: '',
            wall3: '',
            wall4: '',
            floor: '',
            ceiling: '',
            details: '',
          },
          actions: {
            wall1: [],
            wall2: [],
            wall3: [],
            wall4: [],
            floor: [],
            ceiling: [],
            details: [],
          },
          componentNotes: {
            wall1: '',
            wall2: '',
            wall3: '',
            wall4: '',
            floor: '',
            ceiling: '',
            details: '',
          },
          componentPhotos: {
            wall1: [],
            wall2: [],
            wall3: [],
            wall4: [],
            floor: [],
            ceiling: [],
            details: [],
          },
          photos: [],
          isApproved: false,
          isHandled: true,
        },
      ]
      const mockDb = createMockDbForGetById({
        id: 1,
        status: 'Påbörjad',
        date: new Date('2024-01-01'),
        inspector: 'Inspector A',
        type: 'Move-in',
        address: '123 Main St',
        apartmentCode: 'APT001',
        leaseId: 'LEASE001',
        masterKeyAccess: null,
        draftRooms: JSON.stringify(draftRooms),
      })

      const result = await dbAdapter.getInspectionById(mockDb, '1')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.id).toBe('1')
        expect(result.data.rooms).toHaveLength(1)
        expect(result.data.rooms![0].roomId).toBe('room-1')
      }
    })

    it('returns inspection with null rooms when no draft data', async () => {
      const mockDb = createMockDbForGetById({
        id: 1,
        status: 'Registrerad',
        date: new Date('2024-01-01'),
        inspector: 'Inspector A',
        type: 'Move-in',
        address: '123 Main St',
        apartmentCode: 'APT001',
        leaseId: 'LEASE001',
        masterKeyAccess: null,
        draftRooms: null,
      })

      const result = await dbAdapter.getInspectionById(mockDb, '1')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.rooms).toBeNull()
      }
    })

    it('returns not-found when inspection does not exist', async () => {
      const mockDb = createMockDbForGetById(undefined)

      const result = await dbAdapter.getInspectionById(mockDb, '999')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('not-found')
      }
    })

    it('returns error when database fails', async () => {
      const chain: Record<string, jest.Mock> = {}
      chain.select = jest.fn().mockImplementation(() => {
        throw new Error('DB connection failed')
      })
      chain.from = jest.fn().mockReturnValue(chain)
      chain.where = jest.fn().mockReturnValue(chain)

      const mockDb = Object.assign(
        jest.fn().mockReturnValue(chain),
        chain
      ) as unknown as Knex

      const result = await dbAdapter.getInspectionById(mockDb, '1')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('unknown')
      }
    })
  })
})
