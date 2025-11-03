import { InternalWorkOrder } from '@/services/api/core'
import { resolve } from '@/utils/env'

const ODOO_URL = resolve('VITE_ODOO_URL', '')

export const linkToWorkOrderInOdoo = (order: InternalWorkOrder) => {
  // If the order has a URL, open it directly
  if (order.url) return window.open(order.url, '_blank', 'noopener,noreferrer')

  // Fallback:
  // Code looks like this: "od-12345", extract the numeric ID from code
  const workOrderId = order.code.split('-')[1]

  window.open(
    ODOO_URL +
      `/web#id=${workOrderId}&model=maintenance.request&view_type=form`,
    '_blank',
    'noopener,noreferrer'
  )
}

export const linkToOdooCreateMaintenanceRequest = () => {
  window.open(
    ODOO_URL +
      '/web#action=onecore_maintenance_extension.action_maintenance_request_create',
    '_blank',
    'noopener,noreferrer'
  )
}
