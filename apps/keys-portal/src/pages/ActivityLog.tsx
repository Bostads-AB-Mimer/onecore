import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState<LogEventType | 'all'>(
    'all'
  )
  const [objectTypeFilter, setObjectTypeFilter] = useState<
    LogObjectType | 'all'
  >('all')
  const [userNameFilter, setUserNameFilter] = useState('all')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: [
      'logs',
      eventTypeFilter,
      objectTypeFilter,
      userNameFilter,
      searchQuery,
    ],
    queryFn: () =>
      logService.fetchLogs({
        eventType: eventTypeFilter === 'all' ? undefined : [eventTypeFilter],
        objectType: objectTypeFilter === 'all' ? undefined : [objectTypeFilter],
        userName: userNameFilter === 'all' ? undefined : userNameFilter,
        q: searchQuery.trim().length >= 3 ? searchQuery.trim() : undefined,
      }),
  })

  const { data: uniqueUsers = [] } = useQuery({
    queryKey: ['uniqueUsers'],
    queryFn: () => logService.getUniqueUsers(),
  })

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
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              eventType={eventTypeFilter}
              onEventTypeChange={setEventTypeFilter}
              objectType={objectTypeFilter}
              onObjectTypeChange={setObjectTypeFilter}
              userName={userNameFilter}
              onUserNameChange={setUserNameFilter}
              uniqueUsers={uniqueUsers}
            />
          </aside>

          <main>
            {isLoading ? (
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
