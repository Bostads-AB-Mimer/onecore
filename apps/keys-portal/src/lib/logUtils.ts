import type { Log, GroupedLog } from '@/services/types'

/**
 * Groups logs by objectId for better UX
 * - Logs with the same objectId are grouped together into a GroupedLog
 * - Logs without objectId or unique objectId are returned as-is
 * - Groups are sorted by the latest log's eventTime
 */
export function groupLogsByObjectId(logs: Log[]): (Log | GroupedLog)[] {
  const grouped = new Map<string, Log[]>()
  const ungrouped: Log[] = []

  // First pass: group by objectId
  for (const log of logs) {
    if (log.objectId) {
      const existing = grouped.get(log.objectId) ?? []
      existing.push(log)
      grouped.set(log.objectId, existing)
    } else {
      ungrouped.push(log)
    }
  }

  // Build the result array
  const result: (Log | GroupedLog)[] = []

  // Add grouped logs (only if more than 1 log for same objectId)
  for (const [objectId, groupLogs] of grouped.entries()) {
    if (groupLogs.length > 1) {
      // Sort by eventTime descending
      const sortedLogs = groupLogs.sort(
        (a, b) =>
          new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
      )

      result.push({
        objectId,
        count: groupLogs.length,
        latestLog: sortedLogs[0],
        logs: sortedLogs,
      })
    } else {
      // Single log, add as-is
      result.push(groupLogs[0])
    }
  }

  // Add ungrouped logs
  result.push(...ungrouped)

  // Sort the entire result by latest eventTime
  return result.sort((a, b) => {
    const timeA = 'logs' in a ? a.latestLog.eventTime : a.eventTime
    const timeB = 'logs' in b ? b.latestLog.eventTime : b.eventTime
    return new Date(timeB).getTime() - new Date(timeA).getTime()
  })
}
