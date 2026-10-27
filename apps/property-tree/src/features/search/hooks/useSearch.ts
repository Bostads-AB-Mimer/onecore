import type { Invoice } from '@onecore/types'
import { useQuery } from '@tanstack/react-query'

import {
  economyService,
  searchService,
  workOrderService,
} from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import {
  type ContactSearchResult,
  tenantService,
} from '@/services/api/core/tenantService'
import type { InternalWorkOrder } from '@/services/api/core/workOrderService'

import { parseInvoiceNumber } from '@/shared/lib/invoiceUtils'
import { parseErrandNumber } from '@/shared/lib/odooUtils'

type SearchResult = components['schemas']['SearchResult']
type ContactResult = ContactSearchResult & { type: 'contact'; id: string }
type WorkOrderResult = InternalWorkOrder & { type: 'work-order'; id: string }
// Invoice carries its own `type` field ('Regular' | 'Other'), so the result
// wraps the invoice instead of spreading it like the other sources.
type InvoiceResult = { type: 'invoice'; id: string; invoice: Invoice }
export type CombinedSearchResult =
  SearchResult | ContactResult | WorkOrderResult | InvoiceResult

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

      // Digit-only queries are ambiguous (pnr, phone), so no short-circuit like errands.
      const invoiceNumber = parseInvoiceNumber(trimmedQuery)

      // Non-errand query: each source is isolated so a slow/failing source
      // degrades to an empty contribution instead of blanking the whole palette.
      const [propertyResults, contactResults, invoice] = await Promise.all([
        searchService.search(trimmedQuery).catch(() => []),
        tenantService.searchContacts(trimmedQuery).catch(() => []),
        invoiceNumber
          ? economyService.getInvoiceByNumber(invoiceNumber).catch(() => null)
          : null,
      ])

      return [
        ...(invoice
          ? [{ type: 'invoice' as const, id: invoice.invoiceId, invoice }]
          : []),
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
