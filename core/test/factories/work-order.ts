import { Factory } from 'fishery'
import {
  WorkOrder,
  CreateWorkOrderDetails,
  CreateWorkOrder,
} from 'onecore-types'
import { RentalPropertyInfoFactory } from './rental-property-info'
import { TenantFactory } from './tenant'
import { LeaseFactory } from './lease'

export const WorkOrderFactory = Factory.define<WorkOrder>(({ sequence }) => ({
  AccessCaption: 'AccessCaption',
  Caption: 'Caption',
  Code: `WO${sequence}`,
  ContactCode: `P${158769 + sequence}`,
  Description: 'Description',
  DetailsCaption: 'DetailsCaption',
  ExternalResource: false,
  Id: `WO${sequence}`,
  LastChanged: '2021-01-01',
  Priority: 'Priority',
  Registered: '2021-01-01',
  RentalObjectCode: 'RentalObjectCode',
  Status: 'Status',
  UseMasterKey: false,
  WorkOrderRows: [
    {
      Description: 'Description',
      LocationCode: 'LocationCode',
      EquipmentCode: 'EquipmentCode',
    },
  ],
  Messages: [],
}))

export const CreateWorkOrderFactory = Factory.define<CreateWorkOrder>(() => ({
  rentalPropertyInfo: RentalPropertyInfoFactory.build(),
  tenant: TenantFactory.build(),
  lease: LeaseFactory.build(),
  details: CreateWorkOrderDetailsFactory.build(),
}))

export const CreateWorkOrderDetailsFactory =
  Factory.define<CreateWorkOrderDetails>(({ sequence }) => ({
    ContactCode: `P${158769 + sequence}`,
    RentalObjectCode: `123-456-789`,
    Images: [],
    AccessOptions: {
      Type: 0,
      Email: 'test@mimer.nu',
      PhoneNumber: '070000000',
      CallBetween: '08:00 - 17:00',
    },
    Pet: false,
    HearingImpaired: false,
    Rows: [
      {
        LocationCode: 'TV',
        PartOfBuildingCode: 'TM',
        Description: 'Ärendebeskrivning',
        MaintenanceUnitCode: undefined,
        MaintenanceUnitCaption: undefined,
      },
    ],
  }))
