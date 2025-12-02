import z from 'zod'
import {
  XpandWorkOrder,
  XpandWorkOrderDetails as XpandWorkOrderDetails,
} from '../../schemas'
import {
  XpandDbWorkOrder,
  XpandDbWorkOrderDetails as XpandDbWorkOrderDetails,
} from '.'

export function trimStrings<T>(data: T): T {
  if (typeof data === 'string') {
    return data.trim() as T
  }

  if (Array.isArray(data)) {
    return data.map(trimStrings) as T
  }

  if (data !== null && typeof data === 'object') {
    if (data instanceof Date) {
      return data
    }

    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, trimStrings(value)])
    ) as T
  }

  return data
}

export function transformXpandDbWorkOrderDetails(
  dbWorkOrderDetails: XpandDbWorkOrderDetails
): XpandWorkOrderDetails {
  const rowSchema = z.object({
    caption: z.string(),
    locationCaption: z.string().optional(),
    locationCode: z.string().optional(),
    equipmentCaption: z.string().optional(),
    equipmentCode: z.string().optional(),
  })

  try {
    const rows = trimStrings(
      dbWorkOrderDetails.rows
        ? rowSchema.array().parse(JSON.parse(dbWorkOrderDetails.rows))
        : []
    )

    return {
      AccessCaption: dbWorkOrderDetails.masterKey,
      Caption: dbWorkOrderDetails.caption,
      Code: dbWorkOrderDetails.code,
      ContactCode: dbWorkOrderDetails.contactCode,
      Description: rows
        .map((row) =>
          row.locationCaption && row.equipmentCaption
            ? `${row.locationCaption}, ${row.equipmentCaption}: ${row.caption}`
            : row.caption
        )
        .join('\n'),
      Id: dbWorkOrderDetails.code,
      LastChanged: new Date(dbWorkOrderDetails.lastChanged),
      Priority: dbWorkOrderDetails.priority,
      Registered: new Date(dbWorkOrderDetails.createdAt),
      DueDate: dbWorkOrderDetails.expiresAt
        ? new Date(dbWorkOrderDetails.expiresAt)
        : null,
      RentalObjectCode: dbWorkOrderDetails.residenceId,
      Status: xpandStatusToString(dbWorkOrderDetails.status),
      WorkOrderRows: rows.map((row) => ({
        Description: row.locationCaption
          ? `${row.locationCaption}: ${row.caption}`
          : row.caption,
        LocationCode: row.locationCode ?? null,
        EquipmentCode: row.equipmentCode ?? null,
      })),
    } satisfies XpandWorkOrderDetails
  } catch (error) {
    throw new Error(`Failed to transform work order from xpand: ${error}`)
  }
}

export function transformXpandDbWorkOrder(
  dbWorkOrder: XpandDbWorkOrder
): XpandWorkOrder {
  try {
    return {
      AccessCaption: dbWorkOrder.masterKey,
      Caption: dbWorkOrder.caption,
      Code: dbWorkOrder.code,
      ContactCode: dbWorkOrder.contactCode,
      Id: dbWorkOrder.code,
      LastChanged: new Date(dbWorkOrder.lastChanged),
      Priority: dbWorkOrder.priority,
      Registered: new Date(dbWorkOrder.createdAt),
      DueDate: dbWorkOrder.expiresAt,
      RentalObjectCode: dbWorkOrder.residenceId ?? '', // Fallback on empty string - some entries have null residenceId when fetching on building id for example
      Status: xpandStatusToString(dbWorkOrder.status),
    }
  } catch (error) {
    throw new Error(`Failed to transform work order from xpand: ${error}`)
  }
}

function xpandStatusToString(status: number) {
  if (status === 0 || status === 4) {
    return 'Väntar på handläggning'
  }
  if (status === 6) {
    return 'Resurs tilldelad'
  }
  if (status <= 15) {
    return 'Påbörjad'
  }
  if (status === 21) {
    return 'Utförd'
  }
  if (status === 80) {
    return 'Skickad'
  }
  if (status === 100) {
    return 'Väntar på beställda varor'
  }
  if (status > 15) {
    return 'Avslutad'
  }

  return `Unknown status: ${status}`
}
