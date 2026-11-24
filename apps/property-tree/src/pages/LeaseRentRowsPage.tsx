import { useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'

import { HomeInsuranceEndDateCell } from '@/features/rent-rows'

import { useLeaseRentRowFilters } from '@/entities/lease/hooks/useLeaseRentRowFilters'

import { ApiError } from '@/services/api/core/baseApi'
import {
  type LeaseRentRow,
  leaseRentRowService,
} from '@/services/api/core/leaseRentRowService'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  FilterBar,
  FilterDropdown,
  MultiSelectFilterDropdown,
} from '@/shared/ui/filters'
import { ViewLayout } from '@/shared/ui/layout'
import { Pagination } from '@/shared/ui/Pagination'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

const statusOptions = [
  { label: 'Gällande', value: 'current' },
  { label: 'Kommande', value: 'upcoming' },
  { label: 'Uppsagd', value: 'about-to-end' },
  { label: 'Upphört', value: 'ended' },
  { label: 'Prel. uppsagt', value: 'preliminary-terminated' },
  { label: 'Inväntar signering', value: 'pending-signature' },
  { label: 'Ej skickat', value: 'not-sent' },
]

const kindOptions = [
  { label: 'Hemförsäkring', value: 'homeInsurance' },
  { label: 'Samma Fr.o.m./T.o.m.', value: 'sameDate' },
]

const amountFormat = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Article timestamps are UTC; show the date in the viewer's time zone.
const formatTimestampDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('sv-SE') : '-'

const formatSyncedAt = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('sv-SE', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

const LeaseRentRowsPage = () => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)
  const filters = useLeaseRentRowFilters()
  const totalRecords = filters.meta?.totalRecords ?? 0
  const syncedAt = formatSyncedAt(filters.meta?.syncedAt)

  const handlePageChange = (newPage: number) => {
    filters.setPage(newPage)
    cardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleExport = async () => {
    if (totalRecords === 0) return
    setIsExporting(true)
    setExportFailed(false)
    try {
      const blob = await leaseRentRowService.exportToExcel(filters.params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `avtalsrader-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        a.remove()
      }, 1000)
    } catch {
      setExportFailed(true)
    } finally {
      setIsExporting(false)
    }
  }

  // Rows come sorted by lease, so a lease's rows are next to each other.
  // Show lease and contact only on its first row, and draw a line above it.
  const firstRowIds = useMemo(() => {
    const seen = new Set<string>()
    const ids = new Set<string>()
    for (const row of filters.rows) {
      if (!seen.has(row.leaseId)) ids.add(row.rowId)
      seen.add(row.leaseId)
    }
    return ids
  }, [filters.rows])
  const startsLease = (row: LeaseRentRow) => firstRowIds.has(row.rowId)

  const columns = [
    {
      key: 'leaseId',
      className: 'whitespace-nowrap',
      label: 'Kontraktsnummer',
      render: (row: LeaseRentRow) =>
        startsLease(row) ? (
          <button
            type="button"
            className="text-left font-medium text-primary hover:underline"
            onClick={() => filters.setSearchInput(row.leaseId)}
            title="Visa bara det här kontraktet"
          >
            {row.leaseId}
          </button>
        ) : null,
    },
    {
      key: 'contactCodes',
      className: 'whitespace-nowrap',
      label: 'Kontakt',
      render: (row: LeaseRentRow) =>
        startsLease(row) ? (
          <span className="font-medium">{row.contactCodes.join(', ')}</span>
        ) : null,
    },
    {
      key: 'articleCode',
      className: 'whitespace-nowrap',
      label: 'Artikel',
      render: (row: LeaseRentRow) => row.articleCode ?? '-',
    },
    {
      key: 'label',
      label: 'Avitext',
      render: (row: LeaseRentRow) => row.label,
    },
    {
      key: 'amount',
      label: 'Belopp',
      className: 'text-right whitespace-nowrap',
      render: (row: LeaseRentRow) => amountFormat.format(row.amount),
    },
    {
      key: 'from',
      className: 'whitespace-nowrap',
      label: 'Fr.o.m.',
      render: (row: LeaseRentRow) => row.from ?? '-',
    },
    {
      key: 'to',
      className: 'whitespace-nowrap',
      label: 'T.o.m.',
      render: (row: LeaseRentRow) => <HomeInsuranceEndDateCell row={row} />,
    },
    {
      key: 'articleCreatedAt',
      className: 'whitespace-nowrap',
      label: 'Skapad',
      hideOnMobile: true,
      render: (row: LeaseRentRow) => (
        <span title={row.articleCreatedAt ?? undefined}>
          {formatTimestampDate(row.articleCreatedAt)}
        </span>
      ),
    },
    {
      key: 'articleUpdatedAt',
      className: 'whitespace-nowrap',
      label: 'Uppdaterad',
      hideOnMobile: true,
      render: (row: LeaseRentRow) => (
        <span title={row.articleUpdatedAt ?? undefined}>
          {formatTimestampDate(row.articleUpdatedAt)}
        </span>
      ),
    },
  ]

  // Home insurance rows: light blue with a blue left edge.
  // A thicker line above the first row of each lease separates the leases.
  const rowClassName = (row: LeaseRentRow) =>
    cn(
      row.isHomeInsurance &&
        'bg-blue-50 hover:bg-blue-100 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-blue-500',
      startsLease(row) && 'border-t-2 border-t-muted-foreground/30'
    )

  return (
    <ViewLayout>
      <h1 className="text-3xl font-bold">Avtalsrader</h1>

      <Card ref={cardRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Avtalsrader</CardTitle>
            {syncedAt && (
              <p className="text-sm text-muted-foreground mt-1">
                Hämtad {syncedAt}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {filters.rows.length} av {totalRecords} rader
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || totalRecords === 0}
            >
              {isExporting ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
          {exportFailed && (
            <div className="mb-4 text-sm text-destructive">
              Exporten misslyckades. Försök igen.
            </div>
          )}
          <div className="mb-6">
            <FilterBar
              searchValue={filters.searchInput}
              onSearchChange={filters.setSearchInput}
              searchPlaceholder="Sök på kontraktsnummer, kontaktnummer, artikel, avitext..."
              hasActiveFilters={filters.hasActiveFilters}
              onClearFilters={filters.clearFilters}
            >
              <MultiSelectFilterDropdown
                options={statusOptions}
                selectedValues={filters.selectedStatuses}
                onSelectionChange={filters.setStatuses}
                placeholder="Status"
              />
              <FilterDropdown
                options={kindOptions}
                selectedValue={filters.selectedKind ?? null}
                onSelectionChange={filters.setKind}
                placeholder="Visa"
              />
            </FilterBar>
          </div>

          {filters.failureCount > 0 &&
          filters.failureReason instanceof ApiError &&
          filters.failureReason.status === 503 &&
          !filters.error ? (
            <div className="text-center py-8 text-muted-foreground">
              Avtalsraderna laddas in, försöker igen automatiskt...
            </div>
          ) : filters.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar avtalsrader...
            </div>
          ) : filters.error ? (
            <div className="text-center py-8 text-destructive">
              {filters.error instanceof ApiError && filters.error.status === 503
                ? 'Avtalsraderna tar längre tid än väntat att ladda — försök igen om en stund'
                : 'Ett fel uppstod vid hämtning av avtalsrader'}
            </div>
          ) : filters.rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga avtalsrader hittades
            </div>
          ) : (
            <div className="relative">
              {filters.isFetching && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 rounded-md">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Söker...</span>
                  </div>
                </div>
              )}
              <ResponsiveTable
                data={filters.rows}
                columns={columns}
                keyExtractor={(row: LeaseRentRow) => row.rowId}
                rowClassName={rowClassName}
              />
            </div>
          )}

          <Pagination
            currentPage={filters.page}
            totalPages={filters.totalPages}
            totalRecords={totalRecords}
            pageSize={filters.pageSize}
            onPageChange={handlePageChange}
            isFetching={filters.isFetching}
          />
        </CardContent>
      </Card>
    </ViewLayout>
  )
}

export default LeaseRentRowsPage
