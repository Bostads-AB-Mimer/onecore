import { InternalWorkOrder } from '@/services/api/core'

import { resolve } from '@/shared/lib/env'
import { ContextType } from '@/shared/types/ui'

const ODOO_URL = resolve('VITE_ODOO_URL', '')
const CREATE_MAINTENANCE_REQUEST_URL = `${ODOO_URL}/web#action=onecore_maintenance_extension.action_maintenance_request_create`
const WINDOW_OPEN_TARGET = '_blank'
const WINDOW_OPEN_FEATURES = 'noopener,noreferrer'

export const linkToWorkOrderInOdoo = (order: InternalWorkOrder) => {
  // If the order has a URL, open it directly
  if (order.url)
    return window.open(order.url, WINDOW_OPEN_TARGET, WINDOW_OPEN_FEATURES)

  // Fallback:
  // Code looks like this: "od-12345", extract the numeric ID from code
  const workOrderId = order.code.split('-')[1]

  window.open(
    ODOO_URL +
      `/web#id=${workOrderId}&model=maintenance.request&view_type=form`,
    WINDOW_OPEN_TARGET,
    WINDOW_OPEN_FEATURES
  )
}

export const linkToOdooCreateMaintenanceRequestForContactCode = (
  contactCode: string
) => {
  const context = {
    default_search_type: 'contactCode',
    default_search_by_number: contactCode,
  }

  // Append "context" parameter to the URL to prefill the contact code and set the search type
  window.open(
    `${CREATE_MAINTENANCE_REQUEST_URL}&context=${encodeURIComponent(JSON.stringify(context))}`,
    WINDOW_OPEN_TARGET,
    WINDOW_OPEN_FEATURES
  )
}

export interface WorkOrderMetadata {
  propertyName?: string
  type?: string
  code?: string
}

// Search types from Odoo
enum SEARCH_TYPES {
  leaseId = 'leaseId', // Kontraktsnummer
  rentalObjectId = 'rentalObjectId', // Hyresobjekt
  contactCode = 'contactCode', // Kundnummer
  pnr = 'pnr', // Personnummer (12 siffror)
  buildingCode = 'buildingCode', // Byggnadskod
  propertyName = 'propertyName', // Fastighetsnamn
}

enum SPACE_CAPTIONS {
  building = 'Byggnad',
  property = 'Fastighet',
  residence = 'Lägenhet',
  laundryRoom = 'Tvättstuga',
  entrance = 'Uppgång',
  environmentShed = 'Miljöbod',
  playground = 'Lekplats',
  facility = 'Lokal',
  parkingSpace = 'Bilplats',
  attic = 'Vind',
  basement = 'Källare',
  bikeStorage = 'Cykelförråd',
  other = 'Övrigt',
  yardOutdoor = 'Gården/Utomhus',
}

// Maps maintenance unit type to a valid Odoo space_caption selection value
const maintenanceUnitTypeToSpaceCaption: Record<string, string> = {
  Tvättstuga: 'Tvättstuga',
  Miljöbod: 'Miljöbod',
  Sopskåp: 'Miljöbod',
  Lekplats: 'Lekplats',
}

export const linkToOdooCreateMaintenanceRequestForContext = (
  contextType: ContextType,
  id: string, // Id is different things depending on contextType
  metadata?: WorkOrderMetadata
) => {
  let context: Record<string, string> | undefined

  switch (contextType) {
    case ContextType.Property:
      context = {
        default_search_type: SEARCH_TYPES.propertyName,
        default_space_caption: SPACE_CAPTIONS.property,
        default_search_value: id,
      }
      break
    case ContextType.Building:
      context = {
        default_search_type: SEARCH_TYPES.buildingCode,
        default_space_caption: SPACE_CAPTIONS.building,
        default_search_value: id,
      }
      break
    case ContextType.Staircase:
      context = {
        default_search_type: SEARCH_TYPES.buildingCode,
        default_space_caption: SPACE_CAPTIONS.entrance,
        default_search_value: id,
      }
      break
    case ContextType.Residence:
      context = {
        default_search_type: SEARCH_TYPES.rentalObjectId,
        default_space_caption: SPACE_CAPTIONS.residence,
        default_search_value: id,
      }
      break
    case ContextType.Facility:
      context = {
        default_search_type: SEARCH_TYPES.rentalObjectId,
        default_space_caption: SPACE_CAPTIONS.facility,
        default_search_value: id,
      }
      break
    case ContextType.ParkingSpace:
      context = {
        default_search_type: SEARCH_TYPES.rentalObjectId,
        default_space_caption: SPACE_CAPTIONS.parkingSpace,
        default_search_value: id,
      }
      break
    case ContextType.MaintenanceUnit: {
      const spaceCaption = metadata?.type
        ? maintenanceUnitTypeToSpaceCaption[metadata.type] ||
          SPACE_CAPTIONS.other
        : SPACE_CAPTIONS.other

      context = {
        default_search_type: SEARCH_TYPES.propertyName,
        default_space_caption: spaceCaption,
        default_search_value: id,
      }

      if (metadata?.code) {
        context.default_maintenance_unit_code = metadata.code
      }
      break
    }
    case ContextType.Tenant:
      context = {
        default_search_type: SEARCH_TYPES.contactCode,
        default_space_caption: SPACE_CAPTIONS.other,
        default_search_value: id,
      }
      break
  }

  if (context) {
    window.open(
      `${CREATE_MAINTENANCE_REQUEST_URL}&context=${encodeURIComponent(
        JSON.stringify(context)
      )}`,
      WINDOW_OPEN_TARGET,
      WINDOW_OPEN_FEATURES
    )
  }
}

export const linkToOdooCreateMaintenanceRequest = () => {
  window.open(
    CREATE_MAINTENANCE_REQUEST_URL,
    WINDOW_OPEN_TARGET,
    WINDOW_OPEN_FEATURES
  )
}
