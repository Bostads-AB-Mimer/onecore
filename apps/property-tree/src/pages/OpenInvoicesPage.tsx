import { useRef } from 'react'
import { Download, Loader2 } from 'lucide-react'

import {
  openInvoiceColumns,
  OpenInvoiceMobileCard,
} from '@/features/open-invoices'

import { useOpenInvoices } from '@/entities/tenant'

import { isCacheWarmingError, listFailure } from '@/services/api/core/baseApi'
import { openInvoiceReportService } from '@/services/api/core/openInvoiceReportService'

import { useExcelExport } from '@/shared/hooks/useExcelExport'
import { useUrlPagination } from '@/shared/hooks/useUrlPagination'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { ViewLayout } from '@/shared/ui/layout'
import { ListQueryState } from '@/shared/ui/ListQueryState'
import { Pagination } from '@/shared/ui/Pagination'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

// Core returns the whole list without paging; the page shows it in parts so
// thousands of rows are not rendered at once.
const PAGE_SIZE = 100

export function OpenInvoicesPage() {
  const cardRef = useRef<HTMLDivElement>(null)
  const { page, setPage } = useUrlPagination({ defaultLimit: PAGE_SIZE })
  const list = useOpenInvoices()
  const exportMutation = useExcelExport(
    openInvoiceReportService.exportToExcel,
    'restlista'
  )

  const invoices = list.data ?? []
  const pageRows = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    cardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <ViewLayout>
      <h1 className="text-3xl font-bold">Restlista</h1>
      <p className="text-muted-foreground">
        Fakturor som inte är betalda, krediterade eller makulerade, äldst
        förfallodatum först
      </p>

      <Card ref={cardRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Öppna fakturor</CardTitle>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {invoices.length} fakturor
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || invoices.length === 0}
            >
              {exportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporterar...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportera Excel
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ListQueryState
            subject="öppna fakturor"
            isWarming={!list.error && isCacheWarmingError(list.failureReason)}
            isLoading={list.isLoading}
            isFetching={list.isFetching}
            failure={list.error ? listFailure(list.error) : undefined}
            isEmpty={invoices.length === 0}
          >
            <ResponsiveTable
              data={pageRows}
              columns={openInvoiceColumns}
              // invoiceNumber is '' for an invoice without reference and OCR,
              // and keyExtractor gets no index, so add the other identifying fields.
              keyExtractor={(row) =>
                [
                  row.invoiceNumber,
                  row.leaseId,
                  row.contactCode,
                  row.invoiceDate,
                  row.dueDate,
                  row.amount,
                ].join('|')
              }
              mobileCardRenderer={OpenInvoiceMobileCard}
            />
          </ListQueryState>

          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(invoices.length / PAGE_SIZE))}
            totalRecords={invoices.length}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
            isFetching={list.isFetching}
          />
        </CardContent>
      </Card>
    </ViewLayout>
  )
}
