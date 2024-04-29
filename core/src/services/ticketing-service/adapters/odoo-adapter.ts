import Odoo from 'odoo-await'
import Config from '../../../common/config'

export interface OdooGetTicket {
  id: number
  phone_number: string
  contact_code: string
  description: string
  priority: string
  pet: string
  call_between: string
  space_code: string
  equipment_code: string
  rental_property_id: string
  request_date: string
  write_date: string
  stage_id: [number, string]
}

// TODO: Add a type for the ticket in onecore-types
export interface TicketOdoo {
  contact_code: string
  rental_property_id: string
  hearing_impaired: boolean
  phone_number: string
  call_between: string
  pet: string
  space_code: string
  equipment_code: string
  description: string
  name: string
  email_address: string
  building_code: string
  building: string
  estate_code: string
  estate: string
  code: string
  space_caption: string
}

const odoo = new Odoo({
  baseUrl: Config.ticketingService.url,
  db: Config.ticketingService.database,
  username: Config.ticketingService.username,
  password: Config.ticketingService.password,
})

const transformTicket = (ticket: OdooGetTicket) => {
  return {
    accessCaption: 'Huvudnyckel',
    caption: `WEBB: ${ticket.space_code}, ${ticket.equipment_code}`,
    code: ticket.id.toString(),
    contactCode: ticket.contact_code,
    description: `${ticket.space_code}, ${ticket.equipment_code}': ${ticket.description}\r\nHusdjur: ${ticket.pet}\r\n Kund nås enklast mellan ${ticket.call_between} \r\n på telefonnummer: ${ticket.phone_number}.`,
    detailsCaption: `${ticket.space_code}, ${ticket.equipment_code}': ${ticket.description}`,
    externalResource: false,
    id: `Odoo ${ticket.id}`,
    lastChange: ticket.write_date,
    priority: ticket.priority,
    registered: ticket.request_date,
    rentalObjectCode: ticket.rental_property_id,
    status: ticket.stage_id[1],
    useMasterKey: true,
    workOrderRows: [
      {
        description: ticket.description,
        locationCode: ticket.space_code,
        equipmentCode: ticket.equipment_code,
      },
    ],
  }
}

const getTicketByContactCode = async (contactCode: string): Promise<any> => {
  await odoo.connect()

  const domain: any[] = [['contact_code', '=', contactCode]]

  const fields: string[] = [
    'contact_code',
    'description',
    'id',
    'priority',
    'pet',
    'call_between',
    'space_code',
    'equipment_code',
    'rental_property_id',
    'request_date',
    'write_date',
    'stage_id',
  ]

  const tickets: OdooGetTicket[] = await odoo.searchRead(
    'maintenance.request',
    domain,
    fields
  )

  return tickets.map(transformTicket)
}

const createNewTicket = async (ticket: TicketOdoo): Promise<any> => {
  await odoo.connect()
  return await odoo.create('maintenance.request', ticket)
}
export { createNewTicket, getTicketByContactCode }
