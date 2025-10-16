import { resolve } from '@/utils/env'

const ODOO_URL = resolve('VITE_ODOO_URL', '')

export const linkToOdooCreateMaintenanceRequest = () => {
  window.open(
    ODOO_URL +
      '/web#action=onecore_maintenance_extension.action_maintenance_request_create'
  )
}
