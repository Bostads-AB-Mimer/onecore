// Database row types (PascalCase to match SQL Server conventions)
export type DbInspection = {
  id: number
  status: string
  date: Date
  startedAt: Date | null
  endedAt: Date | null
  inspector: string
  type: string
  residenceId: string
  address: string
  apartmentCode: string | null
  isFurnished: boolean
  leaseId: string
  isTenantPresent: boolean
  isNewTenantPresent: boolean
  masterKeyAccess: string | null
  hasRemarks: boolean
  notes: string | null
  totalCost: number | null
  remarkCount: number
  createdAt: Date
  updatedAt: Date
}

export type DbInspectionRoom = {
  id: number
  inspectionId: number
  roomName: string
  createdAt: Date
}

export type DbInspectionRemark = {
  id: number
  roomId: number
  remarkId: string
  location: string | null
  buildingComponent: string | null
  notes: string | null
  remarkGrade: number
  remarkStatus: string | null
  cost: number
  invoice: boolean
  quantity: number
  isMissing: boolean
  fixedDate: Date | null
  workOrderCreated: boolean
  workOrderStatus: number | null
  createdAt: Date
}
