import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { sv } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { PageHeader } from '@/components/shared/layout/PageHeader'
import { SearchInput } from '@/components/shared/layout/SearchInput'
import { PaginationControls } from '@/components/common/PaginationControls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MoveInOutTable } from '@/components/move-in-out/MoveInOutTable'
import { useToast } from '@/hooks/use-toast'
import { useUrlPagination } from '@/hooks/useUrlPagination'
import {
  moveInOutService,
  type MoveInOutSortKey,
} from '@/services/api/moveInOutService'
import type { MoveInOutRow, PaginatedResponse } from '@/services/types'

type Mode = 'both' | 'out' | 'in'

const PAGE_SIZE = 100
const CLEARED = 'none'
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * A month "owns" its move-outs; move-ins are shifted one day so a
 * back-to-back handover (Oct 31 -> Nov 1) lands in October, not in both.
 */
function monthRanges(month: Date) {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  return {
    endFrom: iso(first),
    endTo: iso(last),
    startFrom: iso(addDays(first, 1)),
    startTo: iso(addDays(last, 1)),
  }
}

export default function MoveInOut() {
  const pagination = useUrlPagination(PAGE_SIZE)
  const { searchParams, updateUrlParams, setPaginationMeta } = pagination
  const { toast } = useToast()

  // Missing param = this month's default; CLEARED = the user emptied the input
  const defaults = monthRanges(new Date())
  const readDate = (key: keyof typeof defaults) => {
    const v = searchParams.get(key)
    if (v === null) return defaults[key]
    return v === CLEARED ? '' : v
  }
  const endFrom = readDate('endFrom')
  const endTo = readDate('endTo')
  const startFrom = readDate('startFrom')
  const startTo = readDate('startTo')
  const mode = (searchParams.get('mode') as Mode | null) || 'both'
  const q = searchParams.get('q') || ''
  const sortKey =
    (searchParams.get('sort') as MoveInOutSortKey | null) || 'lastDebitDate'
  const sortOrder =
    (searchParams.get('order') as 'asc' | 'desc' | null) || 'asc'
  const page = pagination.currentPage
  const limit = pagination.currentLimit

  const hasEnd = mode !== 'in' && Boolean(endFrom && endTo)
  const hasStart = mode !== 'out' && Boolean(startFrom && startTo)

  // The switcher label follows the move-out range; custom ranges show as such
  const monthAnchor = endFrom || startFrom
  const shownMonth = monthAnchor ? parseISO(monthAnchor) : new Date()
  const isWholeMonth =
    JSON.stringify(monthRanges(shownMonth)) ===
    JSON.stringify({ endFrom, endTo, startFrom, startTo })
  const monthLabel = isWholeMonth
    ? format(shownMonth, 'LLLL yyyy', { locale: sv })
    : 'Anpassat intervall'

  const goToMonth = (month: Date) =>
    updateUrlParams({ ...monthRanges(month), page: '1' })

  // Local input state so typing does not hit the URL on every keystroke
  const [searchInput, setSearchInput] = useState(q)
  useEffect(() => setSearchInput(q), [q])

  // react-query dedupes concurrent fetches (StrictMode) and caches per filter
  const { data, isLoading, isError, error } = useQuery<
    PaginatedResponse<MoveInOutRow>,
    { status?: number; reason?: string }
  >({
    queryKey: [
      'move-in-out',
      endFrom,
      endTo,
      startFrom,
      startTo,
      mode,
      q,
      sortKey,
      sortOrder,
      page,
      limit,
    ],
    enabled: hasEnd || hasStart,
    queryFn: () =>
      moveInOutService.list({
        ...(hasEnd ? { endDateFrom: endFrom, endDateTo: endTo } : {}),
        ...(hasStart ? { startDateFrom: startFrom, startDateTo: startTo } : {}),
        ...(q ? { q } : {}),
        sortBy: sortKey,
        sortOrder,
        page,
        limit,
      }),
    retry: false,
  })

  useEffect(() => {
    if (data) setPaginationMeta(data._meta)
  }, [data, setPaginationMeta])

  useEffect(() => {
    if (!isError) return
    const syncing = error?.status === 503
    toast({
      title: syncing ? 'Synkroniserar' : 'Fel',
      description: syncing
        ? (error?.reason ??
          'Taggar synkroniseras från DAX, försök igen om några minuter.')
        : 'Kunde inte ladda in- och utflyttar.',
      variant: syncing ? 'default' : 'destructive',
    })
  }, [isError, error, toast])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      const trimmed = value.trim()
      if (trimmed.length >= 3 || trimmed.length === 0) {
        updateUrlParams({ q: trimmed || null, page: '1' })
      }
    },
    [updateUrlParams]
  )

  const handleSortChange = (key: MoveInOutSortKey) => {
    const nextOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc'
    updateUrlParams({ sort: key, order: nextOrder, page: '1' })
  }

  // A pair that the tab excludes is shown blank and disabled; its dates stay in the URL
  const dateInput = (
    id: string,
    label: string,
    value: string,
    active: boolean
  ) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={active ? value : ''}
        disabled={!active}
        className="w-[160px]"
        onChange={(e) =>
          updateUrlParams({ [id]: e.target.value || CLEARED, page: '1' })
        }
      />
    </div>
  )

  const rows = data?.content ?? []
  const total = data?._meta.totalRecords ?? 0

  return (
    <div className="container mx-auto py-8 px-4">
      <PageHeader
        title="In- och utflytt"
        subtitle={`${rows.length} av ${total} objekt`}
      />

      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="icon"
          aria-label="Föregående månad"
          onClick={() => goToMonth(addMonths(startOfMonth(shownMonth), -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[180px] text-center text-lg font-medium capitalize">
          {monthLabel}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Nästa månad"
          onClick={() => goToMonth(addMonths(startOfMonth(shownMonth), 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        {dateInput('endFrom', 'Utflytt från', endFrom, mode !== 'in')}
        {dateInput('endTo', 'Utflytt till', endTo, mode !== 'in')}
        {dateInput('startFrom', 'Inflytt från', startFrom, mode !== 'out')}
        {dateInput('startTo', 'Inflytt till', startTo, mode !== 'out')}
        <Tabs
          value={mode}
          onValueChange={(v) =>
            updateUrlParams({ mode: v === 'both' ? null : v, page: '1' })
          }
        >
          <TabsList>
            <TabsTrigger value="both">Båda</TabsTrigger>
            <TabsTrigger value="out">Utflytt</TabsTrigger>
            <TabsTrigger value="in">Inflytt</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1 min-w-[240px]">
          <SearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Sök objekt, adress, namn eller kundnummer..."
          />
        </div>
      </div>

      <MoveInOutTable
        rows={rows}
        isLoading={isLoading}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />

      <PaginationControls
        paginationMeta={pagination.paginationMeta}
        pageLimit={pagination.currentLimit}
        customLimit={pagination.customLimit}
        isFocused={pagination.isFocused}
        onPageChange={pagination.handlePageChange}
        onLimitChange={pagination.handleLimitChange}
        onCustomLimitChange={pagination.setCustomLimit}
        onCustomLimitSubmit={pagination.handleCustomLimitSubmit}
        onFocusChange={pagination.setIsFocused}
      />
    </div>
  )
}
