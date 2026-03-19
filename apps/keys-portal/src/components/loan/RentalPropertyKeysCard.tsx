import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
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
import { rentalObjectSearchService } from '@/services/api/rentalObjectSearchService'

type Props = {
  rentalPropertyId: string
  defaultTab?: 'keys' | 'history' | ''
}

export function RentalPropertyKeysCard({
  rentalPropertyId,
  defaultTab = 'keys',
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [copied, setCopied] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [keyLoansRefreshKey, setKeyLoansRefreshKey] = useState(0)
  const [keyStatusRefreshKey, setKeyStatusRefreshKey] = useState(0)

  const [keysTabOpened, setKeysTabOpened] = useState(defaultTab === 'keys')
  const [historyTabOpened, setHistoryTabOpened] = useState(
    defaultTab === 'history'
  )

  // Minimal lease to satisfy LeaseKeyStatusList/KeyLoansHistory which require a Lease prop.
  // status: 'Current' ensures key management actions (add, dispose) are enabled.
  // tenants: [] means loan/return buttons are naturally hidden (no contact codes).
  const shellLease = useMemo<Lease>(
    () => ({
      leaseId: '',
      leaseNumber: '',
      leaseStartDate: new Date().toISOString(),
      status: 'Current',
      rentalPropertyId,
      type: '',
      tenants: [],
    }),
    [rentalPropertyId]
  )

  useEffect(() => {
    let cancelled = false
    rentalObjectSearchService
      .getAddressByRentalId(rentalPropertyId)
      .then((addr) => {
        if (!cancelled) setAddress(addr)
      })
    return () => {
      cancelled = true
    }
  }, [rentalPropertyId])

  const handleReceiptUploaded = useCallback(() => {
    setKeyStatusRefreshKey((prev) => prev + 1)
    setKeyLoansRefreshKey((prev) => prev + 1)
  }, [])

  const handleCopyObjectId = async () => {
    try {
      await navigator.clipboard.writeText(rentalPropertyId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  return (
    <Card className="relative border rounded-xl overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-[13px] font-medium">
          <div className="flex items-center gap-2">
            <Building className="w-3.5 h-3.5" />
            <span className="tabular-nums">{rentalPropertyId}</span>
          </div>

          <div className="flex items-center gap-2">
            <RentalObjectNotes rentalObjectCode={rentalPropertyId} />
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 pb-3 bg-background">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 text-[13px]">
          <div className="md:col-span-6 min-h-[1rem]">
            <div className="text-muted-foreground">
              {address === null ? 'Hämtar adress…' : address}
            </div>
          </div>

          <div className="md:col-span-6 flex items-center md:justify-end">
            <button
              onClick={handleCopyObjectId}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer group"
              title="Klicka för att kopiera"
            >
              <span>Objekt-ID:</span>
              <span className="tabular-nums">{rentalPropertyId}</span>
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

          {keysTabOpened && (
            <div
              className={`mt-3 pt-3 border-t bg-slate-50 -mx-6 px-6 -mb-3 pb-3 rounded-b-xl ${
                activeTab !== 'keys' ? 'hidden' : ''
              }`}
            >
              <LeaseKeyStatusList
                lease={shellLease}
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
                lease={shellLease}
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
