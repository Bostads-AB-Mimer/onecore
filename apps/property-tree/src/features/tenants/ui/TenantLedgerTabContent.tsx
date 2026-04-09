import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseAsString, useQueryState } from 'nuqs'

import { useTenantInvoices } from '@/entities/tenant'

import { Button } from '@/shared/ui/Button'
import { CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { InvoiceFilters } from './InvoiceFilters'
import { InvoicesTable } from './InvoicesTable'

const pageSize = 20

interface TenantLedgerTabContentProps {
  contactCode: string
}

export const TenantLedgerTabContent = ({
  contactCode,
}: TenantLedgerTabContentProps) => {
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
    return [contactCode, fromDate, toDate].join('|')
  }, [contactCode, fromDate, toDate])

  const {
    data: invoicesResult,
    isLoading,
    error,
  } = useTenantInvoices(
    contactCode,
    fromDate,
    toDate,
    pageSize,
    xpandInvoicesFetched,
    lastXledgerInvoiceCursor,
    undefined // paymentStatus not used in backend at the moment
  )

  useEffect(() => {
    setLastXledgerInvoiceCursor(undefined)
    setXpandInvoicesFetched(0)
    setAccumulatedInvoices([])
    setIsLoadingMore(false)
  }, [filterKey])

  useEffect(() => {
    if (invoicesResult) {
      const { invoices } = invoicesResult

      setAccumulatedInvoices((prev) => {
        if (prev.length === 0) {
          return [...invoices]
        } else {
          return [...prev, ...invoices]
        }
      })
    }

    setIsLoadingMore(false)
  }, [invoicesResult])

  const onClickFetchMore = useCallback(() => {
    if (isLoadingMore || !invoicesResult) {
      return
    }

    setIsLoadingMore(true)

    if (invoicesResult.pageInfo.endCursor) {
      setLastXledgerInvoiceCursor(invoicesResult.pageInfo.endCursor)
    }

    setXpandInvoicesFetched(invoicesResult.pageInfo.xpandInvoicesFetched)
  }, [invoicesResult, isLoadingMore])

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
