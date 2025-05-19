import { Factory } from 'fishery'
import {
  CoreXpandWorkOrder,
  CoreXpandWorkOrderDetails,
} from '../../src/services/work-order-service/schemas'

export const XpandWorkOrderFactory = Factory.define<CoreXpandWorkOrder>(
  ({ sequence }) => ({
    AccessCaption: 'AccessCaption',
    Caption: 'Caption',
    Code: `WO${sequence}`,
    ContactCode: `P${158769 + sequence}`,
    Id: `WO${sequence}`,
    LastChanged: new Date(),
    Priority: 'Priority',
    Registered: new Date(),
    RentalObjectCode: 'RentalObjectCode',
    Status: 'Väntar på handläggning',
  })
)

export const XpandWorkOrderDetailsFactory =
  Factory.define<CoreXpandWorkOrderDetails>(({ sequence }) => ({
    AccessCaption: 'AccessCaption',
    Caption: 'Caption',
    Code: `WO${sequence}`,
    ContactCode: `P${158769 + sequence}`,
    Description: 'Description',
    Id: `WO${sequence}`,
    LastChanged: new Date(),
    Priority: 'Priority',
    Registered: new Date(),
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
