import { Factory } from 'fishery'
import { XpandWorkOrder, XpandWorkOrderDetails } from '../../schemas'
import {
  XpandDbWorkOrder,
  XpandDbWorkOrderDetails,
} from '../../adapters/xpand-adapter'

export const XpandWorkOrderDetailsFactory =
  Factory.define<XpandWorkOrderDetails>(({ sequence }) => ({
    AccessCaption: 'Huvudnyckel',
    Caption: sequence % 2 === 0 ? `Work Order ${sequence}` : null,
    Code: `WO-${sequence}`,
    ContactCode: sequence % 2 === 0 ? `C-${sequence}` : null,
    Description: 'This is a work order description.',
    Id: `${sequence}`,
    LastChanged: new Date(),
    Priority: sequence % 2 === 0 ? 'High' : null,
    Registered: new Date(),
    RentalObjectCode: `RO-${sequence}`,
    Status: 'Resurs tilldelad',
    WorkOrderRows: [
      {
        Description: 'Row description',
        LocationCode: 'LOC1',
        EquipmentCode: 'EQ1',
      },
    ],
  }))

export const XpandWorkOrderFactory = Factory.define<XpandWorkOrder>(
  ({ sequence }) => ({
    AccessCaption: 'Huvudnyckel',
    Caption: sequence % 2 === 0 ? `Work Order ${sequence}` : null,
    Code: `WO-${sequence}`,
    ContactCode: sequence % 2 === 0 ? `C-${sequence}` : null,
    Id: `${sequence}`,
    LastChanged: new Date(),
    Priority: sequence % 2 === 0 ? 'High' : null,
    Registered: new Date(),
    RentalObjectCode: `RO-${sequence}`,
    Status: 'Resurs tilldelad',
  })
)

export const XpandDbWorkOrderDetailsFactory =
  Factory.define<XpandDbWorkOrderDetails>(({ sequence }) => ({
    code: `WO-${sequence}`,
    caption: sequence % 2 === 0 ? `Work Order ${sequence}` : null,
    contactCode: sequence % 2 === 0 ? `C-${sequence}` : null,
    masterKey: sequence % 2 === 0 ? 'Huvudnyckel' : 'Ej huvudnyckel',
    status: sequence % 3,
    resource: `Resource-${sequence}`,
    resourceGroup: `Group-${sequence}`,
    createdAt: new Date(),
    lastChanged: new Date(),
    priority: sequence % 2 === 0 ? '7 dagar' : null,
    residenceId: `406-028-02-${sequence}`,
    rows: JSON.stringify([
      {
        caption: `Row caption ${sequence}`,
        locationCode: `LOC-${sequence}`,
        equipmentCode: `EQ-${sequence}`,
      },
    ]),
  }))

export const XpandDbWorkOrderFactory = Factory.define<XpandDbWorkOrder>(
  ({ sequence }) => ({
    code: `WO-${sequence}`,
    caption: sequence % 2 === 0 ? `Work Order ${sequence}` : null,
    contactCode: sequence % 2 === 0 ? `C-${sequence}` : null,
    masterKey: sequence % 2 === 0 ? 'Huvudnyckel' : 'Ej huvudnyckel',
    status: sequence % 3,
    resource: `Resource-${sequence}`,
    resourceGroup: `Group-${sequence}`,
    createdAt: new Date(),
    lastChanged: new Date(),
    priority: sequence % 2 === 0 ? '7 dagar' : null,
    residenceId: `406-028-02-${sequence}`,
  })
)
