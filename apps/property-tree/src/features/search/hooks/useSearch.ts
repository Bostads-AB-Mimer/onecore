import { useQuery } from '@tanstack/react-query'

import { searchService, workOrderService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import {
  type ContactSearchResult,
  tenantService,
} from '@/services/api/core/tenantService'
import type { InternalWorkOrder } from '@/services/api/core/workOrderService'
import { parseErrandNumber } from '@/shared/lib/odooUtils'

type SearchResult = components['schemas']['SearchResult']
type ContactResult = ContactSearchResult & { type: 'contact'; id: string }
type WorkOrderResult = InternalWorkOrder & { type: 'work-order'; id: string }
export type CombinedSearchResult =
  | SearchResult
  | ContactResult
  | WorkOrderResult

export function useSearch(query: string) {
  const trimmedQuery = query.trim()
  return useQuery({
    queryKey: ['search', trimmedQuery],
    enabled: Boolean(trimmedQuery) && trimmedQuery.length > 2,
    queryFn: async (): Promise<CombinedSearchResult[]> => {
      const errandNumber = parseErrandNumber(trimmedQuery)

      // An `od-<number>` query only ever resolves to a single Odoo errand, so
      // short-circuit to that endpoint and skip the property/contact backends.
      if (errandNumber) {
        const workOrder = await workOrderService
          .getWorkOrderByCode(errandNumber)
          .catch(() => null)

        return workOrder
          ? [{ ...workOrder, type: 'work-order' as const, id: workOrder.code }]
          : []
      }

      // Non-errand query: each source is isolated so a slow/failing source
      // degrades to an empty contribution instead of blanking the whole palette.
      const [propertyResults, contactResults] = await Promise.all([
        searchService.search(trimmedQuery).catch(() => []),
        tenantService.searchContacts(trimmedQuery).catch(() => []),
      ])

      return [
        ...propertyResults,
        ...contactResults.map((contact) => ({
          ...contact,
          type: 'contact' as const,
          id: contact.contactCode,
        })),
      ]
    },
  })
}
