import { useState, useCallback } from 'react'
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
import type { Lease } from '@/services/types'
import { LeaseKeyStatusList } from './LeaseKeyStatusList'
import { KeyLoansHistory } from './KeyLoansHistory'
import { RentalObjectNotes } from './RentalObjectNotes'
import { deriveDisplayStatus, pickEndDate } from '@/lib/lease-status'

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
    return { label: 'Avslutat', variant: 'destructive' as const }
  return { label: 'Aktivt', variant: 'default' as const }
}

type Props = {
  lease: Lease
  rentalAddress?: string
  defaultTab?: 'keys' | 'history' | ''
}

export function ContractCard({ lease, rentalAddress, defaultTab = '' }: Props) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const addressStr = rentalAddress ?? null
  const addrLoading = !rentalAddress

  const [copied, setCopied] = useState(false)
  const [keyLoansRefreshKey, setKeyLoansRefreshKey] = useState(0)
  const [keyStatusRefreshKey, setKeyStatusRefreshKey] = useState(0)

  // Track if tabs have been opened at least once (for lazy loading + persistence)
  const [keysTabOpened, setKeysTabOpened] = useState(defaultTab === 'keys')
  const [historyTabOpened, setHistoryTabOpened] = useState(
    defaultTab === 'history'
  )

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

  const derived = deriveDisplayStatus(lease)
  const { label, variant } = statusBadge(derived)

  const startStr = format(new Date(lease.leaseStartDate), 'dd MMM yyyy', {
    locale: sv,
  })
  const endIso = pickEndDate(lease)
  const endStr = endIso
    ? format(new Date(endIso), 'dd MMM yyyy', { locale: sv })
    : undefined

  return (
    <Card className="relative border rounded-xl overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-[13px] font-medium">
          <div className="flex items-center gap-2">
            {getLeaseTypeIcon(lease.type)}
            <span className="tabular-nums">{lease.leaseId}</span>
            <Badge variant="outline" className="text-[11px] py-0.5">
              {(lease.type || 'Okänd').trim()}
            </Badge>
            <Badge variant={variant} className="text-[11px] py-0.5">
              {label}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <RentalObjectNotes rentalObjectCode={lease.rentalPropertyId} />
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
        </div>

        <div className="mt-3">
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-100/70 p-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                const newTab = activeTab === 'keys' ? '' : 'keys'
                setActiveTab(newTab)
                if (newTab === 'keys') setKeysTabOpened(true)
              }}
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
              onClick={() => {
                const newTab = activeTab === 'history' ? '' : 'history'
                setActiveTab(newTab)
                if (newTab === 'history') setHistoryTabOpened(true)
              }}
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

          {/* Keep tabs mounted but hidden to preserve state and avoid refetching */}
          {keysTabOpened && (
            <div
              className={`mt-3 pt-3 border-t bg-slate-50 -mx-6 px-6 -mb-3 pb-3 rounded-b-xl ${
                activeTab !== 'keys' ? 'hidden' : ''
              }`}
            >
              <LeaseKeyStatusList
                lease={lease}
                refreshTrigger={keyStatusRefreshKey}
                onKeysLoaned={() => {
                  setActiveTab('history')
                  setHistoryTabOpened(true)
                  setKeyLoansRefreshKey((prev) => prev + 1)
                }}
                onKeysReturned={() => {
                  setActiveTab('history')
                  setHistoryTabOpened(true)
                  setKeyLoansRefreshKey((prev) => prev + 1)
                }}
              />
            </div>
          )}

          {historyTabOpened && (
            <div
              className={`mt-3 pt-3 border-t bg-slate-50 -mx-6 px-6 -mb-3 pb-3 rounded-b-xl ${
                activeTab !== 'history' ? 'hidden' : ''
              }`}
            >
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
