import { useEffect, useMemo, useState } from 'react'
import type { Key, Lease, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { keyService } from '@/services/api/keyService'
import { getKeyLoanStatus, type KeyLoanInfo } from '@/utils/keyLoanStatus'

type KeyWithStatus = Key & {
  loanInfo: KeyLoanInfo
  displayStatus: string
  canRent: boolean
}

const KEY_TYPE_ORDER: Partial<Record<KeyType, number>> = {
  LGH: 1,
  PB: 2,
  FS: 3,
  HN: 4,
}

function isLeaseNotPast(lease: Lease): boolean {
  // If no end date, it's current or future
  if (!lease.leaseEndDate) return true

  // If has end date, check if it's in the future
  const now = new Date()
  const endDate = new Date(lease.leaseEndDate)
  return endDate >= now
}

function getLeaseContactNames(lease: Lease): string[] {
  return (lease.tenants ?? [])
    .map((t) => [t.firstName, t.lastName].filter(Boolean).join(' ').trim())
    .filter(Boolean)
}

export function LeaseKeyStatusList({ lease }: { lease: Lease }) {
  const [keys, setKeys] = useState<Key[]>([])
  const [keysWithStatus, setKeysWithStatus] = useState<KeyWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  const tenantNames = useMemo(() => getLeaseContactNames(lease), [lease])
  const leaseIsNotPast = useMemo(() => isLeaseNotPast(lease), [lease])

  // Fetch keys for the rental object
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const list = await keyService.searchKeys({
          rentalObjectCode: lease.rentalPropertyId,
        })
        if (!cancelled) setKeys(list.content)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId])

  // Get status for each key
  useEffect(() => {
    if (keys.length === 0) {
      setKeysWithStatus([])
      return
    }

    let cancelled = false
    ;(async () => {
      const statusPromises = keys.map(async (key) => {
        try {
          const loanInfo = await getKeyLoanStatus(
            key.id,
            tenantNames[0],
            tenantNames[1]
          )

          let displayStatus = ''
          let canRent = false

          if (loanInfo.isLoaned) {
            // Currently loaned
            if (loanInfo.contact && tenantNames.includes(loanInfo.contact)) {
              displayStatus = `Loaned by this tenant (${loanInfo.contact})`
            } else {
              displayStatus = `Loaned by ${loanInfo.contact ?? 'Unknown'}`
            }
          } else {
            // Not currently loaned - can rent if lease is not past
            canRent = leaseIsNotPast

            if (loanInfo.contact === null) {
              // Never loaned
              displayStatus = 'New'
            } else if (tenantNames.includes(loanInfo.contact)) {
              // Returned by this tenant
              displayStatus = `Returned by this tenant (${loanInfo.contact})`
            } else {
              // Returned by someone else
              displayStatus = `Returned by ${loanInfo.contact}`
            }
          }

          return {
            ...key,
            loanInfo,
            displayStatus,
            canRent,
          } as KeyWithStatus
        } catch (error) {
          // If error fetching status, mark as unknown
          return {
            ...key,
            loanInfo: { isLoaned: false, contact: null },
            displayStatus: 'Unknown status',
            canRent: false,
          } as KeyWithStatus
        }
      })

      const results = await Promise.all(statusPromises)
      if (!cancelled) setKeysWithStatus(results)
    })()

    return () => {
      cancelled = true
    }
  }, [keys, tenantNames, leaseIsNotPast])

  // Sort keys by type and sequence
  const sortedKeys = useMemo(() => {
    const getTypeRank = (t: KeyType) => KEY_TYPE_ORDER[t] ?? 999
    const getSeq = (k: Key) =>
      k.keySequenceNumber == null
        ? Number.POSITIVE_INFINITY
        : Number(k.keySequenceNumber)

    return [...keysWithStatus].sort((a, b) => {
      const typeCmp =
        getTypeRank(a.keyType as KeyType) - getTypeRank(b.keyType as KeyType)
      if (typeCmp !== 0) return typeCmp

      const seqCmp = getSeq(a) - getSeq(b)
      if (seqCmp !== 0) return seqCmp

      return (a.keyName || '').localeCompare(b.keyName || '')
    })
  }, [keysWithStatus])

  // Summary counts by type
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    keysWithStatus.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [keysWithStatus])

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading keys...</div>
  }

  if (sortedKeys.length === 0) {
    return (
      <Card className="mt-2">
        <CardContent className="p-3">
          <div className="text-sm text-muted-foreground">
            No keys found for this rental object.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-2">
      <CardContent className="space-y-4 p-3">
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(KeyTypeLabels).map(([t, label]) => {
            const n = countsByType.get(t) ?? 0
            if (!n) return null
            return (
              <Badge key={t} variant="secondary" className="text-xs">
                {label}: {n}
              </Badge>
            )
          })}
        </div>

        {/* Keys list */}
        <div className="space-y-1">
          {sortedKeys.map((key, index) => {
            const statusColor = key.loanInfo.isLoaned
              ? 'text-destructive'
              : key.canRent
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground'

            return (
              <div
                key={key.id}
                className={`flex items-center justify-between py-2 px-1 ${
                  index > 0 ? 'border-t border-border/50' : ''
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{key.keyName}</span>
                      <span className="text-xs text-muted-foreground">
                        {KeyTypeLabels[key.keyType as KeyType]}
                      </span>
                      {key.keySequenceNumber && (
                        <span className="text-xs text-muted-foreground">
                          Seq: {key.keySequenceNumber}
                        </span>
                      )}
                      {key.flexNumber && (
                        <span className="text-xs text-muted-foreground">
                          Flex: {key.flexNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${statusColor}`}>
                    {key.displayStatus}
                  </span>
                  {key.canRent && (
                    <Button size="sm" variant="outline">
                      Rent
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
