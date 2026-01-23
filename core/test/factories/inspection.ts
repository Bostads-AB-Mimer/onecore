import { Factory } from 'fishery'

import { components } from '../../src/adapters/inspection-adapter/generated/api-types'

type DetailedXpandInspectionRoom =
  components['schemas']['DetailedXpandInspection']['rooms'][number]
type DetailedXpandInspectionRemark =
  DetailedXpandInspectionRoom['remarks'][number]

export const XpandInspectionFactory = Factory.define<
  components['schemas']['XpandInspection']
>(({ sequence }) => ({
  id: `INS${sequence}`,
  status: 'completed',
  date: new Date('2024-01-01').toISOString(),
  inspector: 'John Doe',
  type: 'move-in',
  address: '123 Main St',
  apartmentCode: `A${sequence}`,
  leaseId: `lease-${sequence}`,
  masterKeyAccess: 'Huvudnyckel',
}))

export const DetailedXpandInspectionFactory = Factory.define<
  components['schemas']['DetailedXpandInspection']
>(() => ({
  id: 'INSPECTION001',
  status: 'Genomförd',
  date: new Date('2023-01-01T10:00:00Z').toISOString(),
  startedAt: new Date('2023-01-01T10:15:00Z').toISOString(),
  endedAt: new Date('2023-01-01T11:00:00Z').toISOString(),
  inspector: 'INSPECTOR001',
  type: 'Type A',
  residenceId: 'RESIDENCE001',
  address: '123 Main St',
  apartmentCode: 'APT001',
  leaseId: 'LEASE001',
  masterKeyAccess: 'Huvudnyckel',
  hasRemarks: true,
  notes: 'Some notes about the inspection.',
  totalCost: 1500,
  remarkCount: 2,
  rooms: [
    {
      room: 'Living Room',
      remarks: [
        DetailedXpandInspectionRemarkFactory.build({
          remarkId: 'REMARK001',
          location: 'Living Room',
        }),
      ],
    },
    {
      room: 'Bedroom',
      remarks: [
        DetailedXpandInspectionRemarkFactory.build({
          remarkId: 'REMARK002',
          location: 'Bedroom',
        }),
      ],
    },
  ],
}))

export const DetailedXpandInspectionRoomFactory =
  Factory.define<DetailedXpandInspectionRoom>(() => ({
    room: 'Living Room',
    remarks: [],
  }))

export const DetailedXpandInspectionRemarkFactory =
  Factory.define<DetailedXpandInspectionRemark>(() => ({
    remarkId: 'REMARK001',
    location: 'Living Room',
    buildingComponent: 'Wall',
    notes: 'Crack in the wall.',
    remarkGrade: 2,
    remarkStatus: 'Open',
    cost: 500,
    invoice: true,
    quantity: 1,
    isMissing: false,
    fixedDate: new Date('2023-02-01T00:00:00Z').toISOString(),
    workOrderCreated: true,
    workOrderStatus: null,
  }))
