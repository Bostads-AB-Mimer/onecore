import Odoo from 'odoo-await'
import striptags from 'striptags'
import { logger } from '@onecore/utilities'
import { groupBy } from 'lodash'
import z from 'zod'
import { logger } from '@onecore/utilities'
import Config from '../../../../common/config'
import {
  transformWorkOrder,
  transformMessages,
  transformEquipmentCode,
} from './utils'
import { AdapterResult } from '../../types'
import {
  CreateInspectionWorkOrderGroup,
  CreateInspectionWorkOrderResult,
  CreateWorkOrderDetails,
  CreateWorkOrderRow,
  Lease,
  MaintenanceTeam,
  MaintenanceUnit,
  OdooWorkOrder,
  OdooWorkOrderMessage,
  RentalProperty,
  Tenant,
  WorkOrder,
  WorkOrderMessage,
} from '../../schemas'
import type { SyncContactToWorkOrderPayload } from '@onecore/types'

// Inspection-origin work orders all use this category + space; resolved by name
// at runtime because Odoo ids differ per environment.
const INSPECTION_WORK_ORDER_CATEGORY = 'Besiktning'
const INSPECTION_SPACE_CAPTION = 'Lägenhet'

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
  'estate_code',
  'property_code', // Mirrors `estate_code` for property-level maintenance requests; both fields hold the same value
  'building_code',
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
      [
        ['rental_property_id', '=', residenceId],
        ['building_code', '=', false],
        ['maintenance_unit_code', '=', false],
      ],
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getWorkOrdersByResidenceId')
    throw err
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getWorkOrdersByContactCode')
    throw err
  }
}

export const getWorkOrdersByPropertyId = async (
  propertyId: string
): Promise<WorkOrder[]> => {
  try {
    await odoo.connect()

    const odooWorkOrders = await odoo.searchRead<OdooWorkOrder>(
      'maintenance.request',
      [
        ['property_code', '=', propertyId],
        ['rental_property_id', '=', false],
        ['building_code', '=', false],
        ['maintenance_unit_code', '=', false],
      ],
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
        messagesById[workOrder.id] satisfies OdooWorkOrderMessage[]
      ),
      Url: WorkOrderUrl(workOrder.id),
    }))

    return workOrders
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getWorkOrdersByPropertyId')
    throw err
  }
}

export const getWorkOrdersByBuildingId = async (
  buildingId: string
): Promise<WorkOrder[]> => {
  try {
    await odoo.connect()

    const odooWorkOrders = await odoo.searchRead<OdooWorkOrder>(
      'maintenance.request',
      [
        ['building_code', '=', buildingId],
        ['rental_property_id', '=', false],
        ['maintenance_unit_code', '=', false],
      ],

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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getWorkOrdersByBuildingId')
    throw err
  }
}

export const getWorkOrdersByMaintenanceUnitCode = async (
  maintenanceUnitCode: string
): Promise<WorkOrder[]> => {
  try {
    await odoo.connect()

    const odooWorkOrders = await odoo.searchRead<OdooWorkOrder>(
      'maintenance.request',
      ['maintenance_unit_code', '=', maintenanceUnitCode],
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getWorkOrdersByMaintenanceUnitCode')
    throw err
  }
}

export const getWorkOrderById = async (
  id: number
): Promise<WorkOrder | undefined> => {
  try {
    await odoo.connect()

    const odooWorkOrders = await odoo.searchRead<OdooWorkOrder>(
      'maintenance.request',
      [['id', '=', id]],
      WORK_ORDER_FIELDS
    )

    const workOrder = odooWorkOrders[0]
    if (!workOrder) {
      return undefined
    }

    const odooWorkOrderMessages = await odoo.searchRead<OdooWorkOrderMessage>(
      'mail.message',
      MESSAGE_DOMAIN([workOrder.id]),
      MESSAGE_FIELDS
    )

    return {
      ...transformWorkOrder(workOrder),
      Messages: transformMessages(odooWorkOrderMessages),
      Url: WorkOrderUrl(workOrder.id),
    }
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getWorkOrderById')
    throw err
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

    const rowMaintenanceUnitCode = details.Rows[0].MaintenanceUnitCode
    const selectedMaintenanceUnit = rowMaintenanceUnitCode
      ? rentalPropertyInfo.maintenanceUnits?.find(
          (mu) => mu.code === rowMaintenanceUnitCode
        )
      : undefined

    if (rowMaintenanceUnitCode && !selectedMaintenanceUnit) {
      logger.warn(
        {
          rowMaintenanceUnitCode,
          rentalPropertyId: rentalPropertyInfo.id,
          availableMaintenanceUnitCodes:
            rentalPropertyInfo.maintenanceUnits?.map((mu) => mu.code) ?? [],
        },
        'createWorkOrder: maintenance unit code provided but not found on rental property'
      )
    }

    const newMaintenanceUnitRecord = selectedMaintenanceUnit
      ? await createMaintenanceUnitRecord(
          selectedMaintenanceUnit,
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.createWorkOrder')
    throw err
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.createRentalPropertyRecord')
    throw err
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.createLeaseRecord')
    throw err
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.createTenantRecord')
    throw err
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.createMaintenanceUnitRecord')
    throw err
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
    const supportedSpaceCodes = z.enum(['TV', 'BWC', 'KÖ', 'LGH', 'FÖR', 'KÄL'])
    const odooSpaceCategory: Record<
      z.infer<typeof supportedSpaceCodes>,
      string
    > = {
      TV: 'Tvättstuga',
      BWC: 'Lägenhet',
      KÖ: 'Lägenhet',
      LGH: 'Lägenhet',
      FÖR: 'Lägenhet',
      KÄL: 'Lägenhet',
    }
    const spaceInTitle: Record<z.infer<typeof supportedSpaceCodes>, string> = {
      ...odooSpaceCategory,
      FÖR: 'Förråd',
      KÄL: 'Källare',
    }

    const uniqueSpaceCodes: z.infer<typeof supportedSpaceCodes>[] = []
    const uniqueSpaceCaptions: string[] = []
    const uniqueEquipmentCodes: string[] = []
    const descriptions: string[] = []

    details.Rows.forEach((row) => {
      const spaceCodeParseResult = supportedSpaceCodes.safeParse(
        row.LocationCode.trim()
      )
      if (!spaceCodeParseResult.success) {
        throw new Error('Unsupported location code')
      }

      const spaceCode = spaceCodeParseResult.data
      if (!uniqueSpaceCodes.includes(spaceCode)) {
        uniqueSpaceCodes.push(spaceCode)

        if (!uniqueSpaceCaptions.includes(odooSpaceCategory[spaceCode])) {
          uniqueSpaceCaptions.push(odooSpaceCategory[spaceCode])
        }
      }

      const trimmedPartOfBuildingCode = row.PartOfBuildingCode.trim()
      if (!uniqueEquipmentCodes.includes(trimmedPartOfBuildingCode)) {
        uniqueEquipmentCodes.push(trimmedPartOfBuildingCode)
      }

      if (details.Rows.length > 1) {
        descriptions.push(
          `${transformEquipmentCode(trimmedPartOfBuildingCode)}: ${row.Description}`
        )
      } else {
        descriptions.push(row.Description)
      }
    })

    const name =
      uniqueEquipmentCodes.includes('SD') ||
      uniqueEquipmentCodes.includes('DJUR')
        ? `Felanmäld Skadedjur - ${[...new Set(uniqueSpaceCodes.map((c) => spaceInTitle[c]))].join(', ')}`
        : uniqueEquipmentCodes.length > 1
          ? `Felanmälda vitvaror - ${uniqueEquipmentCodes.map(transformEquipmentCode).join(', ')}`
          : `Felanmäld ${spaceInTitle[uniqueSpaceCodes[0]]} - ${transformEquipmentCode(uniqueEquipmentCodes[0])}`

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
      maintenance_request_category_id: await getMaintenanceRequestCategoryId(
        uniqueSpaceCaptions,
        uniqueEquipmentCodes
      ),
      creation_origin: 'mimer-nu',
    })
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.createWorkOrderRecord')
    throw err
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getMaintenanceTeamId')
    throw err
  }
}

const getMaintenanceRequestCategoryId = async (
  uniqueSpaceCaptions: string[],
  uniqueEquipmentCodes: string[]
): Promise<number> => {
  if (
    uniqueEquipmentCodes.includes('SD') ||
    uniqueEquipmentCodes.includes('DJUR')
  ) {
    return getMaintenanceRequestCategoryIdByName('Skadedjur')
  }
  if (uniqueSpaceCaptions.includes('Tvättstuga')) {
    return getMaintenanceRequestCategoryIdByName('Tvättstuga')
  }
  return getMaintenanceRequestCategoryIdByName('Vitvara')
}

const getMaintenanceRequestCategoryIdByName = async (
  name: string
): Promise<number> => {
  try {
    const categories: number[] = await odoo.search(
      'maintenance.request.category',
      { name }
    )
    if (categories.length === 0) {
      throw new Error(`Maintenance request category "${name}" not found`)
    }
    return categories[0]
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.getMaintenanceRequestCategoryIdByName')
    throw err
  }
}

// Lists the selectable resursgrupper (maintenance teams) for the inspection UI.
export const getMaintenanceTeams = async (): Promise<
  AdapterResult<MaintenanceTeam[], unknown>
> => {
  try {
    await odoo.connect()
    const teams = await odoo.searchRead<MaintenanceTeam>(
      'maintenance.team',
      [],
      ['id', 'name']
    )
    return { ok: true, data: teams }
  } catch (error) {
    logger.error({ err: error }, 'odooAdapter.getMaintenanceTeams')
    return { ok: false, err: error }
  }
}

/**
 * Creates one work order per resursgrupp from an inspection. For each group we
 * replicate what the Odoo create form's Save does server-side (its field
 * population is @api.onchange UI-only and does not run on XML-RPC create):
 * create a per-request maintenance.rental.property child from the residence
 * info, then the maintenance.request with the chosen team + Besiktning category,
 * then back-ref the child so it cascade-deletes with the request.
 *
 * When `inspectionId` is provided the operation is idempotent per
 * (inspection, team): the record name encodes both, and if an open request
 * with that name already exists (from a previous, possibly abandoned attempt)
 * its description is refreshed instead of creating a duplicate — so retries
 * after partial failures and re-submissions with added components are safe.
 *
 * Each group is an independent Odoo commit, so one failure does not abort the
 * rest — the per-group outcome is returned to the caller in input order.
 */
export const createInspectionWorkOrders = async (
  rentalProperty: RentalProperty,
  groups: CreateInspectionWorkOrderGroup[],
  inspectionId?: string
): Promise<AdapterResult<CreateInspectionWorkOrderResult[], unknown>> => {
  try {
    await odoo.connect()
    const categoryId = await getMaintenanceRequestCategoryIdByName(
      INSPECTION_WORK_ORDER_CATEGORY
    )

    // The groups are independent commits — run them concurrently. The
    // per-group try/catch converts failures into result entries, so
    // Promise.all never rejects and result order matches the input.
    const results = await Promise.all(
      groups.map(async (group): Promise<CreateInspectionWorkOrderResult> => {
        // The rentalProperty.id fallback covers callers that predate
        // `inspectionId`; those names are not inspection-unique, so the
        // upsert below is only attempted when inspectionId is present.
        const name = `Besiktning ${inspectionId ?? rentalProperty.id} – ${group.maintenanceTeamName}`
        try {
          if (inspectionId) {
            const existing = await odoo.searchRead<{ id: number }>(
              'maintenance.request',
              [
                ['name', '=', name],
                ['stage_id.done', '=', false],
              ],
              ['id']
            )
            if (existing.length > 0) {
              // Created by a previous attempt — refresh the description so
              // components assigned since then land on the same request.
              await odoo.update('maintenance.request', existing[0].id, {
                description: group.descriptionHtml,
              })
              return {
                maintenanceTeamId: group.maintenanceTeamId,
                ok: true,
                workOrderId: existing[0].id,
              }
            }
          }

          // One rental-property child per request (it cascade-deletes with it).
          const rentalPropertyRecord =
            await createRentalPropertyRecord(rentalProperty)

          const workOrderId = await odoo.create('maintenance.request', {
            name,
            space_caption: INSPECTION_SPACE_CAPTION,
            description: group.descriptionHtml,
            rental_property_id: rentalPropertyRecord.toString(),
            maintenance_team_id: group.maintenanceTeamId,
            maintenance_request_category_id: categoryId,
            // Priority is the number of days until due — Odoo computes
            // due_date = request_date + int(priority_expanded). '7' matches
            // the default the agents use for besiktning requests.
            priority_expanded: '7',
            // search_type/search_value mirror what the Odoo create form stores
            // when an agent looks up the property — odoo-onecore uses them to
            // show how the request was matched to the rental object.
            search_type: 'rentalObjectId',
            search_value: rentalProperty.id,
            // creation_origin: 'inspection' is intentionally omitted — Odoo rejects
            // Selection values not in CREATION_ORIGINS. Re-add once the Odoo side
            // adds the 'inspection' origin (the field is nullable, so omitting is safe).
          })

          // Back-ref so the child cascade-deletes with the request (matches Save).
          await odoo.update(
            'maintenance.rental.property',
            rentalPropertyRecord,
            {
              maintenance_request_id: workOrderId,
            }
          )

          return {
            maintenanceTeamId: group.maintenanceTeamId,
            ok: true,
            workOrderId,
          }
        } catch (error) {
          logger.error(
            { err: error, maintenanceTeamId: group.maintenanceTeamId },
            'odooAdapter.createInspectionWorkOrders.group'
          )
          return {
            maintenanceTeamId: group.maintenanceTeamId,
            ok: false,
            err: error instanceof Error ? error.message : String(error),
          }
        }
      })
    )

    return { ok: true, data: results }
  } catch (error) {
    logger.error({ err: error }, 'odooAdapter.createInspectionWorkOrders')
    return { ok: false, err: error }
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.closeWorkOrder')
    throw err
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
  } catch (err) {
    logger.error({ err }, 'odoo-adapter.addMessageToWorkOrder')
    throw err
  }
}

export const syncContact = async (
  payload: SyncContactToWorkOrderPayload
): Promise<
  AdapterResult<
    { updatedCount: number } | null,
    'could-not-update-contact' | 'unknown'
  >
> => {
  try {
    await odoo.connect()

    const tenantIds: number[] = await odoo.search('maintenance.tenant', {
      contact_code: payload.contactCode,
    })

    if (tenantIds.length === 0) {
      logger.warn(
        { contactCode: payload.contactCode },
        'No tenant found in Odoo, skipping'
      )
      return { ok: true, data: null }
    }

    const updateData: Record<string, string> = {
      name: payload.fullName,
    }

    if (payload.emailAddress != null) {
      updateData.email_address = payload.emailAddress
    }

    if (payload.phoneNumber != null) {
      updateData.phone_number = payload.phoneNumber
    }

    for (const tenantId of tenantIds) {
      await odoo.update('maintenance.tenant', tenantId, updateData)
    }

    return { ok: true, data: { updatedCount: tenantIds.length } }
  } catch (error) {
    logger.error(error, 'Error syncing contact to Odoo')
    return { ok: false, err: 'could-not-update-contact' }
  }
}

export const healthCheck = async () => {
  await odoo.connect()
  await odoo.searchRead('maintenance.team')
}
