import { useRef, useState } from 'react'

import type { AudienceObjectType } from '@/features/audience-picker'
import {
  ALL_AUDIENCE_OBJECT_TYPES,
  AudienceCriteriaChips,
  AudienceFilterButton,
  AudiencePickerPanel,
  useAudienceSelectionState,
} from '@/features/audience-picker'

import type { DispatchListItem } from '@/entities/dispatch'
import {
  ChannelBadge,
  DispatchStatusBadge,
  useDispatchFilters,
} from '@/entities/dispatch'

import { formatTimestamp } from '@/shared/lib/formatters'
import { Card, CardContent } from '@/shared/ui/Card'
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
    className: 'hidden @7xl:table-cell',
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
    className: 'hidden @6xl:table-cell',
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
  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false)
  const audienceSelection = useAudienceSelectionState()
  const filters = useDispatchFilters()

  // Object-type filter for the picker; all four = no restriction. Seeded from
  // the URL once (same one-directional model as the node selection).
  const [activeObjectTypes, setActiveObjectTypes] = useState<
    ReadonlySet<AudienceObjectType>
  >(() => {
    const fromUrl = filters.audienceChips
      .filter((c) => c.level === 'objectType')
      .map((c) => c.value as AudienceObjectType)
    return new Set(fromUrl.length ? fromUrl : ALL_AUDIENCE_OBJECT_TYPES)
  })

  const handleToggleObjectType = (type: AudienceObjectType) => {
    setActiveObjectTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        // The last active type can't be deselected (empty audience).
        if (next.size === 1) return prev
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const handlePageChange = (newPage: number) => {
    filters.setPage(newPage)
    cardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // The picker's state lives outside the URL, so clearing the filters has to
  // reset it too — otherwise the cleared nodes stay checked and one apply
  // silently restores what was just cleared.
  const handleClearFilters = () => {
    filters.clearFilters()
    audienceSelection.clear()
    setActiveObjectTypes(new Set(ALL_AUDIENCE_OBJECT_TYPES))
  }

  return (
    <ViewLayout>
      <h1 className="text-3xl font-bold">Utskick</h1>
      <p className="text-muted-foreground">
        Sök och filtrera utskick i kommunikationsloggen
      </p>

      <div className="mt-6 space-y-4">
        <Card>
          <CardContent className="pt-6">
            <FilterBar
              searchValue={filters.searchInput}
              onSearchChange={filters.setSearchInput}
              searchPlaceholder="Sök i ämne och meddelande..."
              hasActiveFilters={filters.hasActiveFilters}
              onClearFilters={handleClearFilters}
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
              <AudienceFilterButton
                open={audiencePickerOpen}
                onToggle={() => setAudiencePickerOpen((o) => !o)}
                activeCount={filters.audienceChips.length}
              />
            </FilterBar>
            {filters.audienceChips.length > 0 && (
              <div className="mt-3">
                <AudienceCriteriaChips
                  items={filters.audienceChips}
                  onRemove={(level, value) => {
                    filters.removeAudienceCriterion(level, value)
                    if (level === 'objectType') {
                      // Keep the picker's buttons in sync; removing the last
                      // type chip means "no restriction" = all types active.
                      setActiveObjectTypes((prev) => {
                        const next = new Set(prev)
                        next.delete(value as AudienceObjectType)
                        return next.size
                          ? next
                          : new Set(ALL_AUDIENCE_OBJECT_TYPES)
                      })
                    } else {
                      audienceSelection.prune(level, value)
                    }
                  }}
                  onRemoveLevel={(level, values) => {
                    filters.removeAudienceLevel(level)
                    if (level === 'objectType') {
                      setActiveObjectTypes(new Set(ALL_AUDIENCE_OBJECT_TYPES))
                    } else {
                      for (const value of values) {
                        audienceSelection.prune(level, value)
                      }
                    }
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <AudiencePickerPanel
          open={audiencePickerOpen}
          onClose={() => setAudiencePickerOpen(false)}
          onApply={filters.applyAudienceCriteria}
          selection={audienceSelection.selection}
          onToggleNode={audienceSelection.toggle}
          onSelectNodes={audienceSelection.selectMany}
          activeObjectTypes={activeObjectTypes}
          onToggleObjectType={handleToggleObjectType}
        />

        <div ref={cardRef} className="space-y-3">
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
        </div>
      </div>
    </ViewLayout>
  )
}

export default DispatchCentrePage
