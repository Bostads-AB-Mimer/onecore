import { useState, useEffect, useCallback, useMemo } from 'react'
import { logService } from '@/services/api/logService'
import { LogFilters } from '@/components/log/LogFilters'
import { LogEventCard } from '@/components/log/LogEventCard'
import { BatchLogCard } from '@/components/log/BatchLogCard'
import { PaginationControls } from '@/components/common/PaginationControls'
import { useUrlPagination } from '@/hooks/useUrlPagination'
import type { LogEventType, LogObjectType, Log } from '@/services/types'

export default function ActivityLog() {
  const pagination = useUrlPagination()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)
  const [uniqueUsers, setUniqueUsers] = useState<string[]>([])

  // Read all filters from URL
  const searchQuery = pagination.searchParams.get('q') || ''
  const eventTypeFilter = (pagination.searchParams.get('eventType') ||
    'all') as LogEventType | 'all'
  const objectTypeFilter = (pagination.searchParams.get('objectType') ||
    'all') as LogObjectType | 'all'
  const userNameFilter = pagination.searchParams.get('userName') || 'all'

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await logService.fetchLogs(
        {
          eventType: eventTypeFilter === 'all' ? undefined : [eventTypeFilter],
          objectType:
            objectTypeFilter === 'all' ? undefined : [objectTypeFilter],
          userName: userNameFilter === 'all' ? undefined : userNameFilter,
          q: searchQuery.trim().length >= 3 ? searchQuery.trim() : undefined,
        },
        pagination.currentPage,
        pagination.currentLimit
      )

      setLogs(response.content)
      pagination.setPaginationMeta(response._meta)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [
    searchQuery,
    eventTypeFilter,
    objectTypeFilter,
    userNameFilter,
    pagination,
  ])

  // Fetch unique users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await logService.getUniqueUsers()
        setUniqueUsers(users)
      } catch (error) {
        console.error('Failed to fetch unique users:', error)
      }
    }
    fetchUsers()
  }, [])

  // Fetch data whenever URL params change
  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    eventTypeFilter,
    objectTypeFilter,
    userNameFilter,
    pagination.currentPage,
    pagination.currentLimit,
    // fetchLogs intentionally omitted to prevent infinite loop
  ])

  // Sync search input with URL when URL changes
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Helper to update URL params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      pagination.updateUrlParams({ ...updates, page: '1' })
    },
    [pagination]
  )

  // Filter update handlers
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchInput(query)
      // Only update URL if query is empty or has 3+ characters
      if (query.trim().length === 0 || query.trim().length >= 3) {
        updateUrlParams({ q: query.trim() || null })
      }
    },
    [updateUrlParams]
  )

  const handleEventTypeChange = useCallback(
    (type: LogEventType | 'all') => {
      updateUrlParams({ eventType: type === 'all' ? null : type })
    },
    [updateUrlParams]
  )

  const handleObjectTypeChange = useCallback(
    (type: LogObjectType | 'all') => {
      updateUrlParams({ objectType: type === 'all' ? null : type })
    },
    [updateUrlParams]
  )

  const handleUserNameChange = useCallback(
    (userName: string) => {
      updateUrlParams({ userName: userName === 'all' ? null : userName })
    },
    [updateUrlParams]
  )

  // Group logs by batchId for display
  const groupedLogs = useMemo(() => {
    const batchGroups = new Map<string, Log[]>()
    const individualLogs: Log[] = []

    // Separate logs into batches and individual logs
    for (const log of logs) {
      if (log.batchId) {
        const existing = batchGroups.get(log.batchId)
        if (existing) {
          existing.push(log)
        } else {
          batchGroups.set(log.batchId, [log])
        }
      } else {
        individualLogs.push(log)
      }
    }

    // Create display items: batches (if multiple logs) or individual logs
    const displayItems: Array<{ type: 'batch' | 'individual'; logs: Log[] }> =
      []

    // Add batches (only group if 2+ logs share the same batchId)
    for (const [batchId, batchLogs] of batchGroups.entries()) {
      if (batchLogs.length > 1) {
        // Sort by eventTime (newest first within batch)
        batchLogs.sort(
          (a, b) =>
            new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
        )
        displayItems.push({ type: 'batch', logs: batchLogs })
      } else {
        // Single log with batchId - treat as individual
        displayItems.push({ type: 'individual', logs: batchLogs })
      }
    }

    // Add individual logs (no batchId)
    for (const log of individualLogs) {
      displayItems.push({ type: 'individual', logs: [log] })
    }

    // Sort all display items by the first log's eventTime (to maintain chronological order)
    displayItems.sort(
      (a, b) =>
        new Date(b.logs[0].eventTime).getTime() -
        new Date(a.logs[0].eventTime).getTime()
    )

    return displayItems
  }, [logs])

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container py-6">
          <h1 className="text-3xl font-bold">Händelseloggar</h1>
          <p className="text-muted-foreground mt-1">
            Spåra alla ändringar och aktiviteter i systemet
          </p>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid lg:grid-cols-[300px_1fr] gap-8">
          <aside>
            <LogFilters
              searchQuery={searchInput}
              onSearchChange={handleSearchChange}
              eventType={eventTypeFilter}
              onEventTypeChange={handleEventTypeChange}
              objectType={objectTypeFilter}
              onObjectTypeChange={handleObjectTypeChange}
              userName={userNameFilter}
              onUserNameChange={handleUserNameChange}
              uniqueUsers={uniqueUsers}
            />
          </aside>

          <main>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Laddar händelser...
              </div>
            ) : groupedLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Inga händelser hittades
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {groupedLogs.map((item, index) =>
                    item.type === 'batch' ? (
                      <BatchLogCard
                        key={`batch-${item.logs[0].batchId}-${index}`}
                        logs={item.logs}
                      />
                    ) : (
                      <LogEventCard key={item.logs[0].id} log={item.logs[0]} />
                    )
                  )}
                </div>

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
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
