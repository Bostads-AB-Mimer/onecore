import { Factory } from 'fishery'
import {
  XpandDbInspection,
  XpandDbDetailedInspection,
  XpandDbDetailedInspectionRemark,
} from '../../adapters/xpand-adapter'
import {
  XpandInspection,
  DetailedXpandInspection,
  DetailedXpandInspectionRoom,
  DetailedXpandInspectionRemark,
} from '../../schemas'

export const XpandDbInspectionFactory = Factory.define<XpandDbInspection>(
  () => ({
    id: 'INSPECTION001',
    status: 1,
    date: new Date('2023-01-01T10:00:00Z'),
    inspector: 'INSPECTOR001',
    type: 'Type A',
    address: '123 Main St',
    apartmentCode: 'APT001',
    leaseId: 'LEASE001',
    masterKeyAccess: 'Huvudnyckel',
  })
)

export const XpandInspectionFactory = Factory.define<XpandInspection>(() => ({
  id: 'INSPECTION001',
  status: 'Genomförd',
  date: new Date('2023-01-01T10:00:00Z'),
  inspector: 'INSPECTOR001',
  type: 'Type A',
  address: '123 Main St',
  apartmentCode: 'APT001',
  leaseId: 'LEASE001',
  masterKeyAccess: 'Huvudnyckel',
}))

export const XpandDbDetailedInspectionFactory =
  Factory.define<XpandDbDetailedInspection>(() => ({
    id: 'INSPECTION001',
    status: 1,
    date: new Date('2023-01-01T10:00:00Z'),
    startedAt: new Date('2023-01-01T10:15:00Z'),
    endedAt: new Date('2023-01-01T11:00:00Z'),
    inspector: 'INSPECTOR001',
    type: 'Type A',
    residenceId: 'RESIDENCE001',
    address: '123 Main St',
    apartmentCode: 'APT001',
    isFurnished: 0,
    leaseId: 'LEASE001',
    isTenantPresent: 1,
    isNewTenantPresent: 0,
    masterKeyAccess: 'Huvudnyckel',
    hasRemarks: true,
    notes: 'Some notes about the inspection.',
    totalCost: 1500,
  }))

export const DetailedXpandInspectionFactory =
  Factory.define<DetailedXpandInspection>(() => ({
    id: 'INSPECTION001',
    status: 'Genomförd',
    date: new Date('2023-01-01T10:00:00Z'),
    startedAt: new Date('2023-01-01T10:15:00Z'),
    endedAt: new Date('2023-01-01T11:00:00Z'),
    inspector: 'INSPECTOR001',
    type: 'Type A',
    residenceId: 'RESIDENCE001',
    address: '123 Main St',
    apartmentCode: 'APT001',
    isFurnished: false,
    leaseId: 'LEASE001',
    isTenantPresent: true,
    isNewTenantPresent: false,
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

export const XpandDbDetailedInspectionRemarkFactory =
  Factory.define<XpandDbDetailedInspectionRemark>(() => ({
    remarkId: 'REMARK001',
    location: 'Living Room',
    buildingComponent: 'Wall',
    notes: 'Crack in the wall.',
    remarkGrade: 2,
    remarkStatus: 'Open',
    cost: 500,
    invoice: 1,
    quantity: 1,
    isMissing: 0,
    fixedDate: new Date('2023-02-01T00:00:00Z'),
    workOrderCreated: 1,
    workOrderStatus: null,
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
    fixedDate: new Date('2023-02-01T00:00:00Z'),
    workOrderCreated: true,
    workOrderStatus: null,
  }))
