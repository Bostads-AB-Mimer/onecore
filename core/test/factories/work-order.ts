import { Factory } from 'fishery'
import { WorkOrderRentalPropertyFactory } from './rental-property-info'
import { WorkOrderTenantFactory } from './tenant'
import { WorkOrderLeaseFactory } from './lease'
import { CoreWorkOrder } from '../../src/services/work-order-service/schemas'
import { components } from '../../src/adapters/work-order-adapter/generated/api-types'

export const WorkOrderFactory = Factory.define<CoreWorkOrder>(
  ({ sequence }) => ({
    AccessCaption: 'AccessCaption',
    Caption: 'Caption',
    Code: `WO${sequence}`,
    ContactCode: `P${158769 + sequence}`,
    Description: 'Description',
    DetailsCaption: 'DetailsCaption',
    ExternalResource: false,
    Id: `WO${sequence}`,
    LastChanged: new Date(),
    Priority: 'Priority',
    Registered: new Date(),
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
  })
)

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
