import striptags from 'striptags'
import { last } from 'lodash'
import {
  OdooWorkOrder,
  OdooWorkOrderMessage,
  WorkOrder,
  WorkOrderMessage,
} from '../../schemas'

const removePTags = (text: string): string =>
  text ? text.replace(/<\/?p>/g, '') : ''

const spaceCodes: Record<string, string> = {
  TV: 'Tvättstuga',
}

const equipmentCodes: Record<string, string> = {
  TM: 'Tvättmaskin',
  TT: 'Torktumlare',
  TS: 'Torkskåp',
  MA: 'Mangel',
  TÅ: 'Torkskåp',
  SP: 'Spis/ugn',
  KY: 'Kyl',
  FR: 'Frys',
  KF: 'Kyl/frys',
  MU: 'Microvågsugn',
  DM: 'Diskmaskin',
}

export const transformSpaceCode = (space_code: string): string => {
  return spaceCodes[space_code] || ''
}

export const transformEquipmentCode = (equipment_code: string): string => {
  return equipmentCodes[equipment_code] || ''
}

export const transformWorkOrder = (odooWorkOrder: OdooWorkOrder): WorkOrder => {
  const spaceCode = transformSpaceCode(odooWorkOrder.space_code)
  const equipmentCode = transformEquipmentCode(odooWorkOrder.equipment_code)
  const description = removePTags(odooWorkOrder.description)

  const isCommonSpace = Object.keys(spaceCodes).includes(
    odooWorkOrder.space_code
  )

  const masterKeyAccessCaption = odooWorkOrder.master_key
    ? 'Huvudnyckel'
    : 'Ej huvudnyckel'

  const descriptionWithMoreInfo = `${description}${isCommonSpace ? '' : `\r\n Husdjur: ${odooWorkOrder.pet}`}
  ${odooWorkOrder.call_between ? `\r\n Kund nås enklast mellan ${odooWorkOrder.call_between} \r\n på telefonnummer: ${odooWorkOrder.phone_number}.` : ''}`

  return {
    AccessCaption: isCommonSpace ? 'Gemensamt utrymme' : masterKeyAccessCaption,
    Caption:
      spaceCode && equipmentCode
        ? `WEBB: ${spaceCode}, ${equipmentCode}`
        : `WEBB: ${odooWorkOrder.name}`,
    Code: 'od-' + odooWorkOrder.id,
    ContactCode: odooWorkOrder.contact_code,
    Description:
      spaceCode && equipmentCode
        ? `${spaceCode}, ${equipmentCode}: ${descriptionWithMoreInfo}`
        : odooWorkOrder.name + ` ${descriptionWithMoreInfo}`,
    DetailsCaption:
      spaceCode && equipmentCode
        ? `${spaceCode}, ${equipmentCode}`
        : odooWorkOrder.name + `: ${description}`,
    ExternalResource: false,
    Id: odooWorkOrder.uuid,
    LastChanged: new Date(
      odooWorkOrder.write_date || odooWorkOrder.create_date
    ),
    Priority: odooWorkOrder.priority || '',
    Registered: new Date(odooWorkOrder.create_date),
    DueDate: odooWorkOrder.due_date ? new Date(odooWorkOrder.due_date) : null,
    RentalObjectCode: odooWorkOrder.rental_property_id[1],
    Status: odooWorkOrder.stage_id[1],
    HiddenFromMyPages: odooWorkOrder.hidden_from_my_pages || false,
    UseMasterKey: odooWorkOrder.master_key || false,
    WorkOrderRows: [
      {
        Description: odooWorkOrder.description || null,
        LocationCode: odooWorkOrder.space_code || null,
        EquipmentCode: odooWorkOrder.equipment_code || null,
      },
    ],
  }
}

export const transformMessages = (
  messages: OdooWorkOrderMessage[] = []
): WorkOrderMessage[] =>
  messages.map((message) => ({
    id: message.id,
    body: striptags(message.body, ['br']).replaceAll('<br>', '\n'),
    messageType: message.message_type,
    author: last(message.author_id[1].split(', ')) ?? '', // author name is in format "YourCompany, Mitchell Admin"
    createDate: new Date(message.create_date + ' UTC'), // Create new date as UTC (odoo db stores dates without time zone)
  }))
