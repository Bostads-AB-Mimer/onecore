import { Factory } from 'fishery'

import { components } from '../../src/adapters/work-order-adapter/generated/api-types'

export const OdooWorkOrderFactory = Factory.define<
  components['schemas']['WorkOrder']
>(({ sequence }) => ({
  AccessCaption: 'AccessCaption',
  Caption: 'Caption',
  Code: `WO${sequence}`,
  ContactCode: `P${158769 + sequence}`,
  Description: 'Description',
  DetailsCaption: 'DetailsCaption',
  ExternalResource: false,
  Id: `WO${sequence}`,
  LastChanged: new Date().toISOString(),
  Priority: 'Priority',
  Registered: new Date().toISOString(),
  RentalObjectCode: 'RentalObjectCode',
  DueDate: null,
  Status: 'Status',
  WorkOrderRows: [
    {
      Description: 'Description',
      LocationCode: 'LocationCode',
      EquipmentCode: 'EquipmentCode',
    },
  ],
  Messages: [],
  UseMasterKey: false,
}))

export const XpandWorkOrderFactory = Factory.define<
  components['schemas']['XpandWorkOrder']
>(({ sequence }) => ({
  AccessCaption: 'AccessCaption',
  Caption: 'Caption',
  Code: `WO${sequence}`,
  ContactCode: `P${158769 + sequence}`,
  Id: `WO${sequence}`,
  LastChanged: new Date().toISOString(),
  Priority: 'Priority',
  Registered: new Date().toISOString(),
  DueDate: null,
  RentalObjectCode: 'RentalObjectCode',
  Status: 'Väntar på handläggning',
}))

export const XpandWorkOrderDetailsFactory = Factory.define<
  components['schemas']['XpandWorkOrderDetails']
>(({ sequence }) => ({
  AccessCaption: 'AccessCaption',
  Caption: 'Caption',
  Code: `WO${sequence}`,
  ContactCode: `P${158769 + sequence}`,
  Description: 'Description',
  Id: `WO${sequence}`,
  LastChanged: new Date().toISOString(),
  Priority: 'Priority',
  Registered: new Date().toISOString(),
  DueDate: null,
  RentalObjectCode: 'RentalObjectCode',
  Status: 'Väntar på handläggning',
  WorkOrderRows: [
    {
      Description: 'Description',
      LocationCode: 'LocationCode',
      EquipmentCode: 'EquipmentCode',
    },
  ],
}))
