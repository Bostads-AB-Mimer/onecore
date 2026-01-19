import { useEffect, useMemo, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Calendar,
  Home,
  Car,
  Package,
  Building,
  KeyRound,
  Copy,
  Check,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { Lease, KeyDetails, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { LeaseKeyStatusList } from './LeaseKeyStatusList'
import { KeyLoansHistory } from './KeyLoansHistory'
import { RentalObjectNotes } from './RentalObjectNotes'
import { deriveDisplayStatus, pickEndDate } from '@/lib/lease-status'
import { rentalObjectSearchService } from '@/services/api/rentalObjectSearchService'
import { keyService } from '@/services/api/keyService'

const getLeaseTypeIcon = (type: string) => {
  const t = (type ?? '').toLowerCase()
  if (t.includes('apartment') || t.includes('lägenhet'))
    return <Home className="w-3.5 h-3.5" />
  if (t.includes('parking') || t.includes('parkering'))
    return <Car className="w-3.5 h-3.5" />
  if (t.includes('storage') || t.includes('förråd'))
    return <Package className="w-3.5 h-3.5" />
  if (t.includes('commercial') || t.includes('lokal'))
    return <Building className="w-3.5 h-3.5" />
  return <Home className="w-3.5 h-3.5" />
}

function statusBadge(status: 'active' | 'upcoming' | 'ended') {
  if (status === 'upcoming')
    return { label: 'Kommande', variant: 'secondary' as const }
  if (status === 'ended')
    return { label: 'Avslutat', variant: 'outline' as const }
  return { label: 'Aktivt', variant: 'default' as const }
}

type Props = {
  lease: Lease
  rentalAddress?: string
  defaultTab?: 'keys' | 'history' | ''
}

export function ContractCard({ lease, rentalAddress, defaultTab = '' }: Props) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [addressStr, setAddressStr] = useState<string | null>(
    rentalAddress ?? null
  )
  const [addrLoading, setAddrLoading] = useState<boolean>(!rentalAddress)

  const [keys, setKeys] = useState<KeyDetails[]>([])
  const [copied, setCopied] = useState(false)
  const [keyLoansRefreshKey, setKeyLoansRefreshKey] = useState(0)
  const [keyStatusRefreshKey, setKeyStatusRefreshKey] = useState(0)

  const handleReceiptUploaded = useCallback(() => {
    // Trigger refresh of key statuses when a receipt is uploaded
    setKeyStatusRefreshKey((prev) => prev + 1)
    // Trigger refresh of key loans which will update unsigned status via callback
    setKeyLoansRefreshKey((prev) => prev + 1)
  }, [])

  const handleCopyObjectId = async () => {
    try {
      await navigator.clipboard.writeText(lease.rentalPropertyId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadAddr() {
      if (rentalAddress) return
      setAddrLoading(true)
      const addr = await rentalObjectSearchService.getAddressByRentalId(
        lease.rentalPropertyId
      )
      if (!cancelled) {
        setAddressStr(addr)
        setAddrLoading(false)
      }
    }
    loadAddr()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId, rentalAddress])

  // Refetch keys function that can be called externally
  const refetchKeys = useCallback(async () => {
    try {
      const keysWithStatus = await keyService.getKeysByRentalObjectCode(
        lease.rentalPropertyId,
        {
          includeLoans: true,
          includeEvents: true,
          includeKeySystem: true,
        }
      )
      setKeys(keysWithStatus)
    } catch (err) {
      console.error('Failed to load keys:', err)
    }
  }, [lease.rentalPropertyId])

  useEffect(() => {
    refetchKeys()
  }, [refetchKeys])

  const derived = deriveDisplayStatus(lease)
  const { label, variant } = statusBadge(derived)

  const startStr = format(new Date(lease.leaseStartDate), 'dd MMM yyyy', {
    locale: sv,
  })
  const endIso = pickEndDate(lease)
  const endStr = endIso
    ? format(new Date(endIso), 'dd MMM yyyy', { locale: sv })
    : undefined

  // 🔹 Count by type using *real* keys
  const keyCounts = useMemo(() => {
    const counts: Partial<Record<KeyType, number>> = {}
    keys.forEach((k) => {
      const t = (k.keyType ?? 'LGH') as KeyType
      counts[t] = (counts[t] ?? 0) + 1
    })
    return counts
  }, [keys])

  const totalKeys = keys.length
  const hasAnyKeys = totalKeys > 0
  const order: KeyType[] = ['LGH', 'PB', 'FS', 'HN']

  return (
    <Card className="relative border rounded-xl overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-[13px] font-medium">
          <div className="flex items-center gap-2">
            {getLeaseTypeIcon(lease.type)}
            <span className="tabular-nums">{lease.leaseId}</span>
            <Badge
              variant="outline"
              className="text-[10px] leading-none py-0.5"
            >
              {(lease.type || 'Okänd').trim()}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <RentalObjectNotes rentalObjectCode={lease.rentalPropertyId} />
            <Badge variant={variant} className="text-[11px] py-0.5">
              {label}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 pb-3 bg-background">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 text-[13px]">
          <div className="md:col-span-6 min-h-[1rem]">
            <div className="text-muted-foreground">
              {addrLoading ? 'Hämtar adress…' : (addressStr ?? 'Okänd adress')}
            </div>

            {lease.tenants?.length ? (
              <div className="text-muted-foreground mt-1">
                Hyresgäst{lease.tenants.length > 1 ? 'er' : ''}:{' '}
                {lease.tenants
                  .map((t) => {
                    const name = [t.firstName, t.lastName]
                      .filter(Boolean)
                      .join(' ')
                    return name || t.fullName || 'Okänt namn'
                  })
                  .filter(Boolean)
                  .join(' & ')}
              </div>
            ) : null}
          </div>

          <div className="md:col-span-3 flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {startStr} – {endStr ?? 'Tillsvidare'}
            </span>
          </div>

          <div className="md:col-span-3 flex items-center md:justify-end">
            <button
              onClick={handleCopyObjectId}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer group"
              title="Klicka för att kopiera"
            >
              <span>Objekt-ID:</span>
              <span className="tabular-nums">{lease.rentalPropertyId}</span>
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>

          {hasAnyKeys && (
            <div className="md:col-span-12 flex flex-wrap items-start gap-1.5 mt-1">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <KeyRound className="h-3.5 w-3.5 opacity-80" />
                <span>Nycklar</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {order.map((t) => {
                  const count = keyCounts[t] ?? 0
                  if (!count) return null
                  return (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border px-1.5 h-5 text-[11px] text-foreground/80"
                      title={`${KeyTypeLabels[t]}: ${count}`}
                    >
                      {KeyTypeLabels[t]}
                      <span className="inline-flex items-center justify-center rounded-full bg-muted px-1 min-w-[1rem] h-4 text-[10px] font-medium">
                        {count}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-100/70 p-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'keys' ? '' : 'keys')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-1.5 ${
                activeTab === 'keys'
                  ? 'bg-background text-foreground shadow'
                  : ''
              }`}
            >
              <KeyRound className="h-4 w-4" />
              Nycklar
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveTab(activeTab === 'history' ? '' : 'history')
              }
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-background text-foreground shadow'
                  : ''
              }`}
            >
              <History className="h-4 w-4" />
              Lånhistorik
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                activeTab === '' ? 'bg-background text-foreground shadow' : ''
              }`}
            >
              {activeTab === '' ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </div>

          {activeTab === 'keys' && (
            <div className="mt-3 pt-3 border-t bg-slate-50 -mx-6 px-6 -mb-3 pb-3 rounded-b-xl">
              <LeaseKeyStatusList
                lease={lease}
                keysData={keys}
                refreshTrigger={keyStatusRefreshKey}
                onKeysLoaned={() => {
                  setActiveTab('history')
                  setKeyLoansRefreshKey((prev) => prev + 1)
                }}
                onKeysReturned={() => {
                  setActiveTab('history')
                  setKeyLoansRefreshKey((prev) => prev + 1)
                }}
                onKeyCreated={refetchKeys}
              />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="mt-3 pt-3 border-t bg-slate-50 -mx-6 px-6 -mb-3 pb-3 rounded-b-xl">
              <KeyLoansHistory
                lease={lease}
                refreshKey={keyLoansRefreshKey}
                onReceiptUploaded={handleReceiptUploaded}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
