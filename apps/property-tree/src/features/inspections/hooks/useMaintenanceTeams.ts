import { useQuery } from '@tanstack/react-query'

import { workOrderService } from '@/services/api/core'

/**
 * Fetches the selectable resursgrupper (Odoo maintenance teams) used when an
 * inspector assigns damaged components to a team before creating work orders.
 * Teams rarely change, so the result is cached aggressively.
 */
export const useMaintenanceTeams = () =>
  useQuery({
    queryKey: ['maintenanceTeams'],
    queryFn: () => workOrderService.getMaintenanceTeams(),
    staleTime: 1000 * 60 * 60,
  })
