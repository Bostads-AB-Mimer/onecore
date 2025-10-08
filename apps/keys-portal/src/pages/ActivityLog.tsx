import { useMemo, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { logService } from '@/services/api/logService'
import { groupLogsByObjectId } from '@/lib/logUtils'
import { LogFilters } from '@/components/log/LogFilters'
import { LogEventCard } from '@/components/log/LogEventCard'
import { GroupedLogCard } from '@/components/log/GroupedLogCard'
import type {
  LogEventType,
  LogObjectType,
  Log,
  GroupedLog,
} from '@/services/types'

function isGroupedLog(log: Log | GroupedLog): log is GroupedLog {
  return 'logs' in log
}

export default function ActivityLog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)
  const [uniqueUsers, setUniqueUsers] = useState<string[]>([])

  // Read all filters from URL
  const searchQuery = searchParams.get('q') || ''
  const eventTypeFilter = (searchParams.get('eventType') || 'all') as
    | LogEventType
    | 'all'
  const objectTypeFilter = (searchParams.get('objectType') || 'all') as
    | LogObjectType
    | 'all'
  const userNameFilter = searchParams.get('userName') || 'all'

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await logService.fetchLogs({
        eventType: eventTypeFilter === 'all' ? undefined : [eventTypeFilter],
        objectType: objectTypeFilter === 'all' ? undefined : [objectTypeFilter],
        userName: userNameFilter === 'all' ? undefined : userNameFilter,
        q: searchQuery.trim().length >= 3 ? searchQuery.trim() : undefined,
      })

      setLogs(response.content)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery, eventTypeFilter, objectTypeFilter, userNameFilter])

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
    // fetchLogs intentionally omitted to prevent infinite loop
  ])

  // Sync search input with URL when URL changes
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Helper to update URL params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams)
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      })
      setSearchParams(newParams)
    },
    [searchParams, setSearchParams]
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

  const groupedLogs = useMemo(() => groupLogsByObjectId(logs), [logs])

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
              <div className="space-y-4">
                {groupedLogs.map((log) =>
                  isGroupedLog(log) ? (
                    <GroupedLogCard key={log.objectId} groupedLog={log} />
                  ) : (
                    <LogEventCard key={log.id} log={log} />
                  )
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
