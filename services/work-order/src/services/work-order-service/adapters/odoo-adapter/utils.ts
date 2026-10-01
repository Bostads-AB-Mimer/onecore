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
  SD: 'Skadedjur',
  DJUR: 'Skadedjur',
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

// What a tenant is shown when an unlabelled outbound message turns up. It is
// the same default Odoo's own write path and backfill take: an author we
// cannot place is Mimer, never a named person and never a supplier.
const TENANT_AUTHOR_FALLBACK = 'Mimer'

// The sender Mina sidor prints beside a message. Odoo decides it when the
// message is written and stores it on the message itself — whether the author
// was one of us or an external contractor, and which resource group they
// answered for, is knowable there and nowhere else, so it is carried across
// rather than derived here.
const messageAuthor = (message: OdooWorkOrderMessage): string => {
  // The tenant wrote this one. Odoo leaves the stored sender empty on
  // from_tenant, and Mina sidor labels the tenant's own messages "Du".
  if (message.message_type === 'from_tenant') {
    return last(message.author_id[1].split(', ')) ?? '' // author name is in format "YourCompany, Mitchell Admin"
  }
  // Everything else is outbound. Falling back to author_id here would put a
  // handläggare's name in front of a tenant, which is the bug this fixes.
  return message.onecore_tenant_author_name || TENANT_AUTHOR_FALLBACK
}

export const transformMessages = (
  messages: OdooWorkOrderMessage[] = []
): WorkOrderMessage[] =>
  messages.map((message) => ({
    id: message.id,
    body: striptags(message.body, ['br']).replaceAll('<br>', '\n'),
    messageType: message.message_type,
    author: messageAuthor(message),
    createDate: new Date(message.create_date + ' UTC'), // Create new date as UTC (odoo db stores dates without time zone)
  }))
