import Odoo from 'odoo-await'
import Config from '../../../common/config'
import {
  ApartmentInfo,
  Lease,
  MaintenanceUnitInfo,
  RentalPropertyInfo,
  Tenant,
} from 'onecore-types'

export interface OdooGetTicket {
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

export interface OdooPostTicket {
  rental_property_id: string
  lease_id: string
  maintenance_unit_id: string
  tenant_id: string
  hearing_impaired: boolean
  phone_number: string
  call_between: string
  pet: string
  space_code: string
  equipment_code: string
  description: string
  images: OdooPostTicketImage[]
  name: string
  space_caption: string
  maintenance_team_id: number
  master_key: boolean
}

interface OdooPostTicketImage {
  Filename: string
  ImageType: number
  Base64String: string
}

const odoo = new Odoo({
  baseUrl: Config.ticketingService.url,
  db: Config.ticketingService.database,
  username: Config.ticketingService.username,
  password: Config.ticketingService.password,
})

const spaceCodes: Record<string, string> = {
  TV: 'Tvättstuga',
}

const equipmentCodes: Record<string, string> = {
  TM: 'Tvättmaskin',
  TT: 'Torktumlare',
  TS: 'Torkskåp',
  MA: 'Mangel',
  TÅ: 'Torkskåp',
}

const transformSpaceCode = (space_code: string) => {
  return spaceCodes[space_code] != undefined ? spaceCodes[space_code] : ''
}

const transformEquipmentCode = (equipment_code: string) => {
  return equipmentCodes[equipment_code] != undefined
    ? equipmentCodes[equipment_code]
    : ''
}

const removePTags = (text: string): string =>
  text ? text.replace(/<\/?p>/g, '') : ''

const transformTicket = (ticket: OdooGetTicket) => {
  const spaceCode = transformSpaceCode(ticket.space_code)
  const equipmentCode = transformEquipmentCode(ticket.equipment_code)
  const description = removePTags(ticket.description)

  return {
    AccessCaption: 'Huvudnyckel',
    Caption:
      spaceCode && equipmentCode
        ? `WEBB: ${spaceCode}, ${equipmentCode}`
        : `WEBB: ${ticket.name}`,
    Code: 'od-' + ticket.id,
    ContactCode: ticket.contact_code,
    Description:
      spaceCode && equipmentCode
        ? `${spaceCode}, ${equipmentCode}: ${description}\r\nHusdjur: ${ticket.pet}\r\n Kund nås enklast mellan ${ticket.call_between} \r\n på telefonnummer: ${ticket.phone_number}.`
        : ticket.name +
          ` ${description}\r\nHusdjur: ${ticket.pet}\r\n Kund nås enklast mellan ${ticket.call_between} \r\n på telefonnummer: ${ticket.phone_number}.`,
    DetailsCaption:
      spaceCode && equipmentCode
        ? `${spaceCode}, ${equipmentCode}`
        : ticket.name + `: ${description}`,
    ExternalResource: false,
    Id: ticket.uuid,
    LastChange: ticket.write_date || ticket.create_date,
    Priority: ticket.priority || '',
    Registered: ticket.create_date,
    RentalObjectCode: ticket.rental_property_id[1],
    Status: ticket.stage_id[1],
    UseMasterKey: true,
    WorkOrderRows: [
      {
        Description: ticket.description,
        LocationCode: spaceCode,
        EquipmentCode: equipmentCode,
      },
    ],
  }
}

const getTicketByContactCode = async (contactCode: string): Promise<any> => {
  await odoo.connect()

  const domain: any[] = [['contact_code', '=', contactCode]]

  const fields: string[] = [
    'uuid',
    'contact_code',
    'name',
    'description',
    'priority',
    'pet',
    'call_between',
    'space_code',
    'equipment_code',
    'rental_property_id',
    'create_date',
    'write_date',
    'stage_id',
    'phone_number',
    'maintenance_unit_code',
    'maintenance_unit_caption',
  ]

  const tickets: OdooGetTicket[] = await odoo.searchRead(
    'maintenance.request',
    domain,
    fields
  )
  return tickets.map(transformTicket)
}

const createRentalPropertyRecord = async (
  propertyInfo: RentalPropertyInfo,
  address: string
) => {
  await odoo.connect()
  const apartmentProperty = propertyInfo.property as ApartmentInfo
  const rentalPropertyRecord = odoo.create('maintenance.rental.property', {
    name: propertyInfo.id,
    rental_property_id: propertyInfo.id,
    property_type: propertyInfo.type,
    address: address,
    code: apartmentProperty.code,
    area: apartmentProperty.area,
    entrance: apartmentProperty.entrance,
    floor: apartmentProperty.floor,
    has_elevator: apartmentProperty.hasElevator ? 'Ja' : 'Nej',
    wash_space: apartmentProperty.washSpace,
    estate_code: apartmentProperty.estateCode,
    estate: apartmentProperty.estate,
    building_code: apartmentProperty.buildingCode,
    building: apartmentProperty.building,
  })

  return rentalPropertyRecord
}

const createLeaseRecord = async (lease: Lease) => {
  await odoo.connect()
  const leaseRecord = odoo.create('maintenance.lease', {
    name: lease.leaseId,
    lease_id: lease.leaseId,
    lease_number: lease.leaseNumber,
    lease_type: lease.type,
    lease_start_date: lease.leaseStartDate ? lease.leaseStartDate : false,
    lease_end_date: lease.leaseEndDate ? lease.leaseEndDate : false,
    contract_date: lease.contractDate ? lease.contractDate : false,
    approval_date: lease.approvalDate ? lease.approvalDate : false,
  })

  return leaseRecord
}

const createTenantRecord = async (tenant: Tenant) => {
  await odoo.connect()
  const tenantRecord = odoo.create('maintenance.tenant', {
    name: tenant.firstName + ' ' + tenant.lastName,
    contact_code: tenant.contactCode,
    contact_key: tenant.contactKey,
    national_registration_number: tenant.nationalRegistrationNumber,
    email_address: tenant.emailAddress,
    phone_number: tenant.phoneNumbers ? tenant.phoneNumbers[0].phoneNumber : '',
    is_tenant: true,
  })

  return tenantRecord
}

const createMaintenanceUnitRecord = async (
  maintenanceUnit: MaintenanceUnitInfo,
  code: string,
  caption: string
) => {
  await odoo.connect()
  const maintenanceUnitRecord = odoo.create('maintenance.maintenance.unit', {
    name: caption,
    caption: caption,
    type: maintenanceUnit.type,
    code: code,
    estate_code: maintenanceUnit.estateCode,
  })

  return maintenanceUnitRecord
}

const createTicket = async (ticket: OdooPostTicket): Promise<number> => {
  await odoo.connect()
  return await odoo.create('maintenance.request', ticket)
}

const getMaintenanceTeamId = async (teamName: string): Promise<number> => {
  await odoo.connect()

  const team: number[] = await odoo.search('maintenance.team', {
    name: teamName,
  })

  return team[0]
}

const healthCheck = async () => {
  await odoo.connect()
  const team: number[] = await odoo.searchRead('maintenance.team')
  if (!team && !team[0]) throw new Error('No maintanance team found')
}

export {
  createTicket,
  createRentalPropertyRecord,
  createLeaseRecord,
  createTenantRecord,
  createMaintenanceUnitRecord,
  getTicketByContactCode,
  getMaintenanceTeamId,
  transformEquipmentCode,
  healthCheck,
}
