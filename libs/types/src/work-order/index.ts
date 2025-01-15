import { Lease, RentalPropertyInfo, Tenant } from '../types'

interface WorkOrder {
  AccessCaption: string
  Caption: string
  Code: string
  ContactCode: string
  Description: string
  DetailsCaption: string
  ExternalResource: boolean
  Id: string
  LastChange: string
  Priority: string
  Registered: string
  RentalObjectCode: string
  Status: string
  UseMasterKey: boolean
  WorkOrderRows: {
    Description: string
    LocationCode: string
    EquipmentCode: string
  }[]
  Messages?: WorkOrderMessage[]
}

interface WorkOrderMessage {
  id: number
  body: string
  messageType: string
  author: string
  createDate: string
}
interface CreateWorkOrder {
  rentalPropertyInfo: RentalPropertyInfo
  tenant: Tenant
  lease: Lease
  details: CreateWorkOrderDetails
}

interface CreateWorkOrderDetails {
  ContactCode: string
  RentalObjectCode: string
  AccessOptions: {
    Type: number
    PhoneNumber: string
    Email: string
    CallBetween: string
  }
  HearingImpaired: boolean
  Pet: boolean
  Rows: CreateWorkOrderRow[]
  Images: CreateWorkOrderImage[]
}

interface CreateWorkOrderRow {
  LocationCode: string
  PartOfBuildingCode: string
  Description: string
  MaintenanceUnitCode?: string
  MaintenanceUnitCaption?: string
}

interface CreateWorkOrderImage {
  Filename: string
  ImageType: number
  Base64String: string
}

interface CreateWorkOrderMessage {
  body: string
}

interface OdooWorkOrder {
  uuid: string
  id: number
  phone_number: string
  name: string
  contact_code: string
  description: string
  priority: string
  pet: string
  call_between: string
  space_code: string
  equipment_code: string
  rental_property_id: string
  create_date: string
  write_date: string
  stage_id: [number, string]
}

interface OdooWorkOrderMessage {
  id: number
  res_id: number
  body: string
  message_type: string
  author_id: [number, string]
  create_date: string
}

export type {
  WorkOrder,
  WorkOrderMessage,
  CreateWorkOrder,
  CreateWorkOrderDetails,
  CreateWorkOrderRow,
  CreateWorkOrderImage,
  CreateWorkOrderMessage,
  OdooWorkOrder,
  OdooWorkOrderMessage,
}
