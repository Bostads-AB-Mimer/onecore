import * as dbAdapter from '../../../adapters/db-adapter'
import { CreateInspectionSchema } from '../../../adapters/db-adapter/schemas'
import { withContext } from '../../testUtils'
import { CreateInspectionParamsFactory } from '../../factories/inspection'

describe('db-adapter', () => {
  describe('createInspection', () => {
    it('creates an inspection with rooms and remarks', () =>
      withContext(async (ctx) => {
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

        const result = await dbAdapter.createInspection(ctx.db, params)

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
      }))

    it('calculates remarkCount correctly', () =>
      withContext(async (ctx) => {
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

        const result = await dbAdapter.createInspection(ctx.db, params)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.remarkCount).toBe(3)
        }
      }))

    it('creates inspection with no remarks', () =>
      withContext(async (ctx) => {
        const params = CreateInspectionParamsFactory.build({
          hasRemarks: false,
          rooms: [
            {
              room: 'Kitchen',
              remarks: [],
            },
          ],
        })

        const result = await dbAdapter.createInspection(ctx.db, params)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.remarkCount).toBe(0)
          expect(result.data.hasRemarks).toBe(false)
          expect(result.data.rooms).toHaveLength(1)
          expect(result.data.rooms[0].remarks).toHaveLength(0)
        }
      }))

    it('creates inspection with nullable fields', () =>
      withContext(async (ctx) => {
        const params = CreateInspectionParamsFactory.build({
          apartmentCode: null,
          startedAt: null,
          endedAt: null,
          masterKeyAccess: null,
          notes: null,
          totalCost: null,
        })

        const result = await dbAdapter.createInspection(ctx.db, params)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.apartmentCode).toBeNull()
          expect(result.data.startedAt).toBeNull()
          expect(result.data.endedAt).toBeNull()
          expect(result.data.masterKeyAccess).toBeNull()
          expect(result.data.notes).toBeNull()
          expect(result.data.totalCost).toBeNull()
        }
      }))

    it('handles remarks with nullable fields', () =>
      withContext(async (ctx) => {
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

        const result = await dbAdapter.createInspection(ctx.db, params)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.rooms[0].remarks[0].location).toBeNull()
          expect(result.data.rooms[0].remarks[0].buildingComponent).toBeNull()
          expect(result.data.rooms[0].remarks[0].notes).toBeNull()
          expect(result.data.rooms[0].remarks[0].remarkStatus).toBeNull()
          expect(result.data.rooms[0].remarks[0].fixedDate).toBeNull()
          expect(result.data.rooms[0].remarks[0].workOrderStatus).toBeNull()
        }
      }))

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
})
