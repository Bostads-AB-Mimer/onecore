import { InternalWorkOrder } from '@/services/api/core'
import { resolve } from '@/utils/env'

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

export const linkToOdooCreateMaintenanceRequest = () => {
  window.open(
    CREATE_MAINTENANCE_REQUEST_URL,
    WINDOW_OPEN_TARGET,
    WINDOW_OPEN_FEATURES
  )
}
