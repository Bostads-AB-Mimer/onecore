import { useRef } from 'react'

import type { DispatchListItem } from '@/entities/dispatch'
import { useDispatchFilters } from '@/entities/dispatch'
import {
  ChannelBadge,
  DispatchStatusBadge,
} from '@/entities/dispatch/ui/CommunicationBadges'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  DateRangeFilterDropdown,
  FilterBar,
  FilterDropdown,
  MultiSelectFilterDropdown,
} from '@/shared/ui/filters'
import { ViewLayout } from '@/shared/ui/layout'
import { Pagination } from '@/shared/ui/Pagination'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

const channelOptions = [
  { label: 'SMS', value: 'sms' },
  { label: 'E-post', value: 'email' },
]

const statusOptions = [
  { label: 'Schemalagt', value: 'scheduled' },
  { label: 'Skickar', value: 'sending' },
  { label: 'Levererat', value: 'delivered' },
  { label: 'Delvis levererat', value: 'partially_delivered' },
  { label: 'Misslyckades', value: 'failed' },
  { label: 'Avbrutet', value: 'cancelled' },
]

const sourceOptions = [
  { label: 'Manuellt', value: 'manual' },
  { label: 'Automatiskt', value: 'automatic' },
]

// Swedish labels for the known messageType values; unknown types fall back to
// the raw value.
const CATEGORY_LABELS: Record<string, string> = {
  bulk_sms: 'Massutskick SMS',
  bulk_email: 'Massutskick e-post',
  work_order_tenant_sms: 'Arbetsorder SMS',
  work_order_tenant_mail: 'Arbetsorder e-post',
  parking_space_offer: 'Bilplatserbjudande',
  parking_space_accept_offer: 'Bilplats accepterat',
  non_scored_parking_space_approved: 'Bilplats godkänd',
  non_scored_parking_space_denied: 'Bilplats nekad',
}
const categoryLabel = (messageType: string) =>
  CATEGORY_LABELS[messageType] ?? messageType

const categoryOptions = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
)

const formatTimestamp = (iso: string): string =>
  new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const truncate = (s: string | null, n = 60) =>
  !s ? '' : s.length > n ? `${s.slice(0, n)}…` : s

const dispatchColumns = [
  {
    key: 'sendAt',
    label: 'Skickat',
    sortKey: 'sendAt',
    render: (d: DispatchListItem) => (
      <span className="whitespace-nowrap text-sm">
        {formatTimestamp(d.sendAt)}
      </span>
    ),
  },
  {
    key: 'createdAt',
    label: 'Skapat',
    sortKey: 'createdAt',
    hideOnMobile: true,
    render: (d: DispatchListItem) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {formatTimestamp(d.createdAt)}
      </span>
    ),
  },
  {
    key: 'channel',
    label: 'Kanal',
    render: (d: DispatchListItem) => <ChannelBadge channel={d.channel} />,
  },
  {
    key: 'message',
    label: 'Meddelande',
    render: (d: DispatchListItem) => (
      <div className="max-w-xs">
        {d.subject && <div className="font-medium truncate">{d.subject}</div>}
        <div className="text-sm text-muted-foreground truncate">
          {truncate(d.body)}
        </div>
      </div>
    ),
  },
  {
    key: 'category',
    label: 'Kategori',
    hideOnMobile: true,
    render: (d: DispatchListItem) => (
      <span className="text-sm">{categoryLabel(d.messageType)}</span>
    ),
  },
  {
    key: 'audience',
    label: 'Målgrupp',
    hideOnMobile: true,
    render: (d: DispatchListItem) =>
      d.audience.length ? (
        <div className="flex flex-wrap gap-1">
          {d.audience.map((c, i) => (
            <span
              key={`${c.type}-${c.value}-${i}`}
              className="text-xs rounded bg-muted px-1.5 py-0.5"
            >
              {c.value}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: 'triggeredByUser',
    label: 'Avsändare',
    hideOnMobile: true,
    render: (d: DispatchListItem) => (
      <span className="text-sm">{d.triggeredByUser ?? '—'}</span>
    ),
  },
  {
    key: 'recipientCount',
    label: 'Mottagare',
    sortKey: 'recipientCount',
    render: (d: DispatchListItem) => (
      <span className="text-sm tabular-nums">{d.recipientCount}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (d: DispatchListItem) => <DispatchStatusBadge status={d.status} />,
  },
]

const DispatchCentrePage = () => {
  const cardRef = useRef<HTMLDivElement>(null)
  const filters = useDispatchFilters()

  const handlePageChange = (newPage: number) => {
    filters.setPage(newPage)
    cardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <ViewLayout>
      <h1 className="text-3xl font-bold">Utskick</h1>
      <p className="text-muted-foreground">
        Sök och filtrera utskick i kommunikationsloggen
      </p>

      <Card ref={cardRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Utskick</CardTitle>
          <span className="text-sm text-muted-foreground">
            {filters.dispatches.length} av {filters.meta?.totalRecords ?? 0}{' '}
            resultat
          </span>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <FilterBar
              searchValue={filters.searchInput}
              onSearchChange={filters.setSearchInput}
              searchPlaceholder="Sök i ämne och meddelande..."
              hasActiveFilters={filters.hasActiveFilters}
              onClearFilters={filters.clearFilters}
            >
              <MultiSelectFilterDropdown
                options={channelOptions}
                selectedValues={filters.selectedChannels}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('channel', vals)
                }
                placeholder="Kanal"
              />
              <MultiSelectFilterDropdown
                options={statusOptions}
                selectedValues={filters.selectedStatuses}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('status', vals)
                }
                placeholder="Status"
              />
              <MultiSelectFilterDropdown
                options={categoryOptions}
                selectedValues={filters.selectedMessageTypes}
                onSelectionChange={(vals) =>
                  filters.setFilterValues('messageType', vals)
                }
                placeholder="Kategori"
              />
              <FilterDropdown
                options={sourceOptions}
                selectedValue={filters.source || null}
                onSelectionChange={(val) =>
                  filters.setFilterValue('source', val)
                }
                placeholder="Källa"
              />
              <DateRangeFilterDropdown
                startDate={filters.sendAtFrom || null}
                endDate={filters.sendAtTo || null}
                onDateChange={(start, end) =>
                  filters.setDateRange('sendAtFrom', 'sendAtTo', start, end)
                }
                placeholder="Datum"
              />
            </FilterBar>
          </div>

          {filters.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar utskick...
            </div>
          ) : filters.error ? (
            <div className="text-center py-8 text-destructive">
              Ett fel uppstod vid hämtning av utskick
            </div>
          ) : (
            <ResponsiveTable
              data={filters.dispatches}
              columns={dispatchColumns}
              keyExtractor={(d) => d.id}
              emptyMessage="Inga utskick hittades"
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onSort={filters.handleSort}
            />
          )}

          <Pagination
            currentPage={filters.page}
            totalPages={filters.totalPages}
            totalRecords={filters.meta?.totalRecords ?? 0}
            pageSize={filters.pageSize}
            onPageChange={handlePageChange}
            isFetching={filters.isFetching}
          />
        </CardContent>
      </Card>
    </ViewLayout>
  )
}

export default DispatchCentrePage
