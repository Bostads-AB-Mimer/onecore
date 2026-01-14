import { InternalWorkOrder } from '@/services/api/core'
import { resolve } from '@/utils/env'
import { ContextType } from '@/types/ui'

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

export const linkToOdooCreateMaintenanceRequestForContext = (
  contextType: ContextType,
  id: string // Id is different things depending on contextType
) => {
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

  switch (contextType) {
    case ContextType.Property:
      window.open(
        `${CREATE_MAINTENANCE_REQUEST_URL}&context=${encodeURIComponent(
          JSON.stringify({
            default_search_type: SEARCH_TYPES.propertyName,
            default_space_caption: SPACE_CAPTIONS.property,
            default_search_value: id, // Property name?
          })
        )}`,
        WINDOW_OPEN_TARGET,
        WINDOW_OPEN_FEATURES
      )
      break
    case ContextType.Building:
      window.open(
        `${CREATE_MAINTENANCE_REQUEST_URL}&context=${encodeURIComponent(
          JSON.stringify({
            default_search_type: SEARCH_TYPES.buildingCode,
            default_space_caption: SPACE_CAPTIONS.building,
            default_search_value: id, // Building code
          })
        )}`,
        WINDOW_OPEN_TARGET,
        WINDOW_OPEN_FEATURES
      )
      break
    case ContextType.Residence:
      window.open(
        `${CREATE_MAINTENANCE_REQUEST_URL}&context=${encodeURIComponent(
          JSON.stringify({
            default_search_type: SEARCH_TYPES.rentalObjectId,
            default_space_caption: SPACE_CAPTIONS.residence,
            default_search_value: id, // rentalId
          })
        )}`,
        WINDOW_OPEN_TARGET,
        WINDOW_OPEN_FEATURES
      )
      break
    case ContextType.Tenant:
      window.open(
        `${CREATE_MAINTENANCE_REQUEST_URL}&context=${encodeURIComponent(
          JSON.stringify({
            default_search_type: SEARCH_TYPES.contactCode,
            default_space_caption: SPACE_CAPTIONS.other,
            default_search_value: id, // contactCode
          })
        )}`,
        WINDOW_OPEN_TARGET,
        WINDOW_OPEN_FEATURES
      )
      break
  }
}

export const linkToOdooCreateMaintenanceRequest = () => {
  window.open(
    CREATE_MAINTENANCE_REQUEST_URL,
    WINDOW_OPEN_TARGET,
    WINDOW_OPEN_FEATURES
  )
}
