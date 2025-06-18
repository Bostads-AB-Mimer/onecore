import { Factory } from 'fishery'

import { WorkOrderRentalPropertyFactory } from './rental-property-info'
import { WorkOrderTenantFactory } from './tenant'
import { WorkOrderLeaseFactory } from './lease'
import {
  CoreWorkOrder,
  CoreXpandWorkOrder,
  CoreXpandWorkOrderDetails,
} from '../../src/services/work-order-service/schemas'
import { components } from '../../src/adapters/work-order-adapter/generated/api-types'

export const WorkOrderFactory = Factory.define<CoreWorkOrder>(
  ({ sequence }) => ({
    accessCaption: 'AccessCaption',
    caption: 'Caption',
    code: `WO${sequence}`,
    contactCode: `P${158769 + sequence}`,
    description: 'Description',
    detailsCaption: 'DetailsCaption',
    externalResource: false,
    id: `WO${sequence}`,
    lastChanged: new Date(),
    priority: 'Priority',
    registered: new Date(),
    rentalObjectCode: 'RentalObjectCode',
    status: 'Status',
    dueDate: null,
    workOrderRows: [
      {
        description: 'Description',
        locationCode: 'LocationCode',
        equipmentCode: 'EquipmentCode',
      },
    ],
    messages: [],
  })
)

export const XpandWorkOrderFactory = Factory.define<CoreXpandWorkOrder>(
  ({ sequence }) => ({
    accessCaption: 'AccessCaption',
    caption: 'Caption',
    code: `WO${sequence}`,
    contactCode: `P${158769 + sequence}`,
    id: `WO${sequence}`,
    lastChanged: new Date(),
    priority: 'Priority',
    registered: new Date(),
    dueDate: null,
    rentalObjectCode: 'RentalObjectCode',
    status: 'Status',
  })
)

export const XpandWorkOrderDetailsFactory =
  Factory.define<CoreXpandWorkOrderDetails>(({ sequence }) => ({
    accessCaption: 'AccessCaption',
    caption: 'Caption',
    code: `WO${sequence}`,
    contactCode: `P${158769 + sequence}`,
    description: 'Description',
    id: `WO${sequence}`,
    lastChanged: new Date(),
    priority: 'Priority',
    registered: new Date(),
    dueDate: null,
    rentalObjectCode: 'RentalObjectCode',
    status: 'Väntar på handläggning',
    workOrderRows: [
      {
        description: 'Description',
        locationCode: 'LocationCode',
        equipmentCode: 'EquipmentCode',
      },
    ],
  }))

export const CreateWorkOrderFactory = Factory.define<
  components['schemas']['CreateWorkOrderBody']
>(() => ({
  rentalProperty: WorkOrderRentalPropertyFactory.build(),
  tenant: WorkOrderTenantFactory.build(),
  lease: WorkOrderLeaseFactory.build(),
  details: CreateWorkOrderDetailsFactory.build(),
}))

export const CreateWorkOrderDetailsFactory = Factory.define<
  components['schemas']['CreateWorkOrderDetails']
>(({ sequence }) => ({
  ContactCode: `P${158769 + sequence}`,
  RentalObjectCode: `123-456-789`,
  Images: [],
  AccessOptions: {
    Type: 0,
    Email: 'test@mimer.nu',
    PhoneNumber: '070000000',
    CallBetween: '08:00 - 17:00',
  },
  Pet: 'Nej',
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
