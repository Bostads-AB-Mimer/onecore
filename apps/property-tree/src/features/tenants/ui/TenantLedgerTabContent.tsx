import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseAsString, useQueryState } from 'nuqs'

import { useTenantInvoices } from '@/entities/tenant'

import { Button } from '@/shared/ui/Button'
import { CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

import {
  InvoiceDateField,
  InvoiceFilters,
  InvoiceStatusField,
  InvoiceTypeField,
} from './InvoiceFilters'
import { InvoicesTable } from './InvoicesTable'

const pageSize = 20

interface TenantLedgerTabContentProps {
  contactCode: string
}

export const TenantLedgerTabContent = ({
  contactCode,
}: TenantLedgerTabContentProps) => {
  const [typeFilter, setTypeFilter] = useState<InvoiceTypeField>('all')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusField>('all')
  const [dateField, setDateField] = useState<InvoiceDateField>('none')
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)
  const [lastXledgerInvoiceCursor, setLastXledgerInvoiceCursor] = useState<
    string | undefined
  >()
  const [xpandInvoicesFetched, setXpandInvoicesFetched] = useState<number>(0)
  const [accumulatedInvoices, setAccumulatedInvoices] = useState<any[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  // Create a key for resetting pagination when filters change
  const filterKey = useMemo(() => {
    return [
      contactCode,
      fromDate,
      toDate,
      typeFilter,
      statusFilter,
      dateField,
    ].join('|')
  }, [contactCode, fromDate, toDate, typeFilter, statusFilter, dateField])

  const {
    data: invoicesWithPaymentEventsResult,
    isLoading,
    error,
  } = useTenantInvoices(
    contactCode,
    fromDate,
    toDate,
    pageSize,
    xpandInvoicesFetched,
    lastXledgerInvoiceCursor,
    true
  )

  useEffect(() => {
    setLastXledgerInvoiceCursor(undefined)
    setXpandInvoicesFetched(0)
    setAccumulatedInvoices([])
    setIsLoadingMore(false)
  }, [filterKey])

  useEffect(() => {
    if (invoicesWithPaymentEventsResult) {
      const { invoices } = invoicesWithPaymentEventsResult

      setAccumulatedInvoices((prev) => {
        if (prev.length === 0) {
          return [...invoices]
        } else {
          return [...prev, ...invoices]
        }
      })
    }

    setIsLoadingMore(false)
  }, [invoicesWithPaymentEventsResult])

  const onClickFetchMore = useCallback(() => {
    if (isLoadingMore || !invoicesWithPaymentEventsResult) {
      return
    }

    setIsLoadingMore(true)

    if (invoicesWithPaymentEventsResult.pageInfo.endCursor) {
      setLastXledgerInvoiceCursor(
        invoicesWithPaymentEventsResult.pageInfo.endCursor
      )
    }

    setXpandInvoicesFetched(
      invoicesWithPaymentEventsResult.pageInfo.xpandInvoicesFetched
    )
  }, [invoicesWithPaymentEventsResult, isLoadingMore])

  const [expandedInvoiceId, setExpandedInvoiceId] = useQueryState(
    'open',
    parseAsString
  )

  const isFirstLoad = isLoading && accumulatedInvoices.length === 0

  return (
    <TabLayout title="Fakturor" showCard={true} isLoading={isFirstLoad}>
      <CardHeader>
        <CardTitle className="text-lg">Fakturor</CardTitle>
        <InvoiceFilters
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          dateField={dateField}
          onDateFieldChange={setDateField}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
        />
      </CardHeader>
      <CardContent>
        {isFirstLoad && <p>Laddar fakturor...</p>}
        {error && (
          <p className="text-red-500">
            Något gick fel vid hämtning av fakturor. Försök igen.
          </p>
        )}
        {accumulatedInvoices.length > 0 && (
          <>
            <InvoicesTable
              onInvoiceRowClick={setExpandedInvoiceId}
              expandedInvoiceId={expandedInvoiceId}
              invoices={accumulatedInvoices}
            />
            <div className="mt-4 flex justify-center">
              <Button
                onClick={onClickFetchMore}
                disabled={isLoadingMore}
                variant="outline"
              >
                {isLoadingMore ? 'Laddar...' : 'Hämta fler'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </TabLayout>
  )
}
