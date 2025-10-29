import Odoo from 'odoo-await'
import striptags from 'striptags'
import { groupBy } from 'lodash'
import z from 'zod'
import Config from '../../../../common/config'
import {
  transformWorkOrder,
  transformMessages,
  transformEquipmentCode,
} from './utils'
import { AdapterResult } from '../../types'
import {
  CreateWorkOrderDetails,
  CreateWorkOrderRow,
  Lease,
  MaintenanceUnit,
  OdooWorkOrder,
  OdooWorkOrderMessage,
  RentalProperty,
  Tenant,
  WorkOrder,
  WorkOrderMessage,
} from '../../schemas'

const odoo = new Odoo({
  baseUrl: Config.odoo.url,
  db: Config.odoo.database,
  username: Config.odoo.username,
  password: Config.odoo.password,
})

const WORK_ORDER_DOMAIN = (contactCode: string) => [
  ['contact_code', '=', contactCode],
]
const WORK_ORDER_FIELDS: string[] = [
  'id',
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
  'due_date',
  'write_date',
  'stage_id',
  'phone_number',
  'hidden_from_my_pages',
  'master_key',
  'maintenance_unit_code',
  'maintenance_unit_caption',
]

const MESSAGE_DOMAIN = (workOrderIds: number[]) => [
  ['res_id', 'in', workOrderIds],
  ['model', '=', 'maintenance.request'],
  [
    'message_type',
    'in',
    [
      'from_tenant',
      'tenant_sms',
      'tenant_mail',
      'tenant_mail_and_sms',
      'failed_tenant_sms',
      'failed_tenant_mail',
      'failed_tenant_mail_and_sms',
    ],
  ],
]
const MESSAGE_FIELDS: string[] = [
  'id',
  'res_id',
  'body',
  'message_type',
  'author_id',
  'create_date',
]

const WorkOrderUrl = (workOrderId: number): string =>
  `${Config.odoo.url}/web#id=${workOrderId}&model=maintenance.request&view_type=form`

export const getWorkOrdersByResidenceId = async (
  residenceId: string
): Promise<WorkOrder[]> => {
  try {
    await odoo.connect()

    const odooWorkOrders = await odoo.searchRead<OdooWorkOrder>(
      'maintenance.request',
      ['rental_property_id', '=', residenceId],
      WORK_ORDER_FIELDS
    )

    const odooWorkOrderMessages = await odoo.searchRead<OdooWorkOrderMessage>(
      'mail.message',
      MESSAGE_DOMAIN(odooWorkOrders.map((workOrder) => workOrder.id)),
      MESSAGE_FIELDS
    )

    const messagesById = groupBy(odooWorkOrderMessages, 'res_id')

    const workOrders = odooWorkOrders.map((workOrder) => ({
      ...transformWorkOrder(workOrder),
      Messages: transformMessages(
        messagesById[workOrder.id]
      ) satisfies WorkOrderMessage[],
      Url: WorkOrderUrl(workOrder.id),
    }))

    return workOrders
  } catch (error) {
    console.error('Error fetching work orders:', error)
    throw error
  }
}

export const getWorkOrdersByContactCode = async (
  contactCode: string
): Promise<WorkOrder[]> => {
  try {
    await odoo.connect()

    const odooWorkOrders = await odoo.searchRead<OdooWorkOrder>(
      'maintenance.request',
      WORK_ORDER_DOMAIN(contactCode),
      WORK_ORDER_FIELDS
    )

    const odooWorkOrderMessages = await odoo.searchRead<OdooWorkOrderMessage>(
      'mail.message',
      MESSAGE_DOMAIN(odooWorkOrders.map((workOrder) => workOrder.id)),
      MESSAGE_FIELDS
    )

    const messagesById = groupBy(odooWorkOrderMessages, 'res_id')

    const workOrders = odooWorkOrders.map((workOrder) => ({
      ...transformWorkOrder(workOrder),
      Messages: transformMessages(messagesById[workOrder.id]),
    }))

    return workOrders
  } catch (error) {
    console.error('Error fetching work orders:', error)
    throw error
  }
}

export const createWorkOrder = async (
  rentalPropertyInfo: RentalProperty,
  tenant: Tenant,
  lease: Lease,
  details: CreateWorkOrderDetails
): Promise<AdapterResult<number, unknown>> => {
  try {
    await odoo.connect()
    const maintenanceTeamId = await getMaintenanceTeamId('Kundcenter')

    const newRentalPropertyRecord =
      await createRentalPropertyRecord(rentalPropertyInfo)
    const newLeaseRecord = await createLeaseRecord(lease)
    const newTenantRecord = await createTenantRecord(tenant, details)

    const newMaintenanceUnitRecord = rentalPropertyInfo.maintenanceUnits
      ? await createMaintenanceUnitRecord(
          rentalPropertyInfo.maintenanceUnits[0],
          details.Rows[0]
        )
      : undefined

    const newWorkOrderId = await createWorkOrderRecord(
      newRentalPropertyRecord,
      newLeaseRecord,
      newTenantRecord,
      newMaintenanceUnitRecord,
      maintenanceTeamId,
      details
    )

    return { ok: true, data: newWorkOrderId }
  } catch (error) {
    console.error('Error creating work order:', error)
    throw error
  }
}

const createRentalPropertyRecord = async (
  rentalPropertyInfo: RentalProperty
): Promise<number> => {
  try {
    const apartmentProperty = rentalPropertyInfo.property
    return await odoo.create('maintenance.rental.property', {
      name: rentalPropertyInfo.id,
      rental_property_id: rentalPropertyInfo.id,
      property_type: rentalPropertyInfo.type,
      address: apartmentProperty.address,
      code: apartmentProperty.code,
      area: apartmentProperty.area,
      entrance: apartmentProperty.entrance,
      floor: apartmentProperty.floor,
      has_elevator: apartmentProperty.hasElevator ? 'Ja' : 'Nej',
      estate_code: apartmentProperty.estateCode,
      estate: apartmentProperty.estate,
      building_code: apartmentProperty.buildingCode,
      building: apartmentProperty.building,
    })
  } catch (error) {
    console.error('Error creating rental property record:', error)
    throw error
  }
}

const createLeaseRecord = async (lease: Lease): Promise<number> => {
  try {
    return await odoo.create('maintenance.lease', {
      name: lease.leaseId,
      lease_id: lease.leaseId,
      lease_number: lease.leaseNumber,
      lease_type: lease.type,
      lease_start_date: lease.leaseStartDate || false,
      lease_end_date: lease.leaseEndDate || false,
      contract_date: lease.contractDate || false,
      approval_date: lease.approvalDate || false,
    })
  } catch (error) {
    console.error('Error creating lease record:', error)
    throw error
  }
}

const createTenantRecord = async (
  tenant: Tenant,
  details: CreateWorkOrderDetails
): Promise<number> => {
  try {
    const { Email: emailAddress, PhoneNumber: phoneNumber } =
      details.AccessOptions

    return await odoo.create('maintenance.tenant', {
      // firstName/lastName will be undefined if the tenant has protected identity
      name: tenant.firstName
        ? `${tenant.firstName} ${tenant.lastName}`
        : 'Namn saknas',
      contact_code: tenant.contactCode,
      contact_key: tenant.contactKey,
      national_registration_number: tenant.nationalRegistrationNumber,
      email_address: emailAddress || tenant.emailAddress,
      phone_number:
        phoneNumber ||
        (tenant.phoneNumbers ? tenant.phoneNumbers[0].phoneNumber : ''),
      is_tenant: true,
    })
  } catch (error) {
    console.error('Error creating tenant record:', error)
    throw error
  }
}

const createMaintenanceUnitRecord = async (
  maintenanceUnit: MaintenanceUnit,
  CreateWorkOrderRow: CreateWorkOrderRow
): Promise<number> => {
  try {
    const { MaintenanceUnitCaption: caption, MaintenanceUnitCode: code } =
      CreateWorkOrderRow

    return await odoo.create('maintenance.maintenance.unit', {
      name: caption || maintenanceUnit.caption,
      caption: caption || maintenanceUnit.caption,
      type: maintenanceUnit.type,
      code: code || maintenanceUnit.code,
    })
  } catch (error) {
    console.error('Error creating maintenance unit record:', error)
    throw error
  }
}

const createWorkOrderRecord = async (
  rentalPropertyRecord: number,
  leaseRecord: number,
  tenantRecord: number,
  maintenanceUnitRecord: number | undefined,
  maintenanceTeamId: number,
  details: CreateWorkOrderDetails
): Promise<number> => {
  try {
    const supportedSpaceCodes = z.enum(['TV', 'BWC', 'KÖ'])
    const captionForSpace: Record<
      z.infer<typeof supportedSpaceCodes>,
      string
    > = {
      TV: 'Tvättstuga',
      BWC: 'Lägenhet',
      KÖ: 'Lägenhet',
    }

    const uniqueSpaceCodes: z.infer<typeof supportedSpaceCodes>[] = []
    const uniqueSpaceCaptions: string[] = []
    const uniqueEquipmentCodes: string[] = []
    const descriptions: string[] = []

    details.Rows.forEach((row) => {
      const spaceCodeParseResult = supportedSpaceCodes.safeParse(
        row.LocationCode
      )
      if (!spaceCodeParseResult.success) {
        throw new Error('Unsupported location code')
      }

      const spaceCode = spaceCodeParseResult.data
      if (!uniqueSpaceCodes.includes(spaceCode)) {
        uniqueSpaceCodes.push(spaceCode)

        if (!uniqueSpaceCaptions.includes(captionForSpace[spaceCode])) {
          uniqueSpaceCaptions.push(captionForSpace[spaceCode])
        }
      }

      if (!uniqueEquipmentCodes.includes(row.PartOfBuildingCode)) {
        uniqueEquipmentCodes.push(row.PartOfBuildingCode)
      }

      if (details.Rows.length > 1) {
        descriptions.push(
          `${transformEquipmentCode(row.PartOfBuildingCode)}: ${row.Description}`
        )
      } else {
        descriptions.push(row.Description)
      }
    })

    const name =
      uniqueEquipmentCodes.length > 1
        ? `Felanmälda vitvaror - ${uniqueEquipmentCodes.map(transformEquipmentCode).join(', ')}`
        : `Felanmäld ${captionForSpace[uniqueSpaceCodes[0]]} - ${transformEquipmentCode(uniqueEquipmentCodes[0])}`

    return await odoo.create('maintenance.request', {
      rental_property_id: rentalPropertyRecord.toString(),
      lease_id: leaseRecord.toString(),
      tenant_id: tenantRecord.toString(),
      maintenance_unit_id: maintenanceUnitRecord?.toString() || false,
      hearing_impaired: details.HearingImpaired,
      call_between: details.AccessOptions.CallBetween,
      pet: details.Pet,
      space_code: uniqueSpaceCodes.join(', '),
      equipment_code: uniqueEquipmentCodes.join(', '),
      description: descriptions.join('<br>'),
      images: details.Images,
      name,
      master_key: details.AccessOptions.Type === 0,
      space_caption: uniqueSpaceCaptions.join(', '),
      maintenance_team_id: maintenanceTeamId,
      maintenance_request_category_id:
        await getMaintenanceRequestCategoryId(uniqueSpaceCaptions),
      creation_origin: 'mimer-nu',
    })
  } catch (error) {
    console.error('Error creating work order record:', error)
    throw error
  }
}

const getMaintenanceTeamId = async (teamName: string): Promise<number> => {
  try {
    const team: number[] = await odoo.search('maintenance.team', {
      name: teamName,
    })

    if (team.length === 0) {
      throw new Error(`Maintenance team with name "${teamName}" not found`)
    }

    return team[0]
  } catch (error) {
    console.error('Error getting maintenance team id:', error)
    throw error
  }
}

const getMaintenanceRequestCategoryId = async (
  uniqueSpaceCaptions: string[]
): Promise<number> => {
  try {
    if (uniqueSpaceCaptions.includes('Tvättstuga')) {
      const categories = await odoo.search('maintenance.request.category', {
        name: 'Tvättstuga',
      })
      return categories[0]
    } else {
      const categories = await odoo.search('maintenance.request.category', {
        name: 'Vitvara',
      })
      return categories[0]
    }
  } catch (error) {
    console.error('Error getting maintenance request category id:', error)
    throw error
  }
}

export const closeWorkOrder = async (workOrderId: number): Promise<boolean> => {
  try {
    await odoo.connect()

    const doneMaintenanceStages = await odoo.searchRead<{
      id: number
    }>(
      'maintenance.stage',
      [
        ['done', '=', true],
        ['name', '=', 'Avslutad'],
      ],
      ['id']
    )

    if (doneMaintenanceStages.length === 0) {
      throw new Error('No done maintenance stages found')
    }

    return await odoo.update('maintenance.request', workOrderId, {
      stage_id: doneMaintenanceStages[0].id,
    })
  } catch (error) {
    console.error('Error closing work order:', error)
    throw error
  }
}

export const addMessageToWorkOrder = async (
  workOrderId: number,
  message: string
): Promise<number> => {
  try {
    await odoo.connect()

    return await odoo.execute_kw('maintenance.request', 'message_post', [
      [workOrderId],
      {
        body: striptags(message).replaceAll('\n', '<br>'),
        message_type: 'from_tenant',
        body_is_html: true,
      },
    ])
  } catch (error) {
    console.error('Error adding message to work order:', error)
    throw error
  }
}

export const healthCheck = async () => {
  await odoo.connect()
  await odoo.searchRead('maintenance.team')
}
