import { useState, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Package,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getBundlesByContactWithLoanedKeys,
  getKeyBundleDetails,
} from '@/services/api/keyBundleService'
import { keyService } from '@/services/api/keyService'
import type {
  BundleWithLoanedKeysInfo,
  KeyBundleDetailsResponse,
} from '@/services/types'
import { MaintenanceKeysTable } from './MaintenanceKeysTable'

type Props = {
  contactCode: string
  onBundleClick: (bundleId: string) => void
}

export function ContactBundlesWithLoanedKeysCard({
  contactCode,
  onBundleClick,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [bundles, setBundles] = useState<BundleWithLoanedKeysInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // State for nested bundle expansion
  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null)
  const [bundleDetails, setBundleDetails] = useState<
    Record<string, KeyBundleDetailsResponse>
  >({})
  const [loadingBundleId, setLoadingBundleId] = useState<string | null>(null)
  const [keySystemMaps, setKeySystemMaps] = useState<
    Record<string, Record<string, string>>
  >({})

  useEffect(() => {
    if (!isOpen || hasLoaded) {
      return
    }

    const fetchBundles = async () => {
      setLoading(true)
      try {
        const data = await getBundlesByContactWithLoanedKeys(contactCode)
        setBundles(data)
        setHasLoaded(true)
      } catch (error) {
        console.error('Error fetching bundles with loaned keys:', error)
        setBundles([])
        setHasLoaded(true)
      } finally {
        setLoading(false)
      }
    }

    fetchBundles()
  }, [isOpen, hasLoaded, contactCode])

  const handleBundleExpand = async (bundleId: string) => {
    // Toggle expansion
    if (expandedBundleId === bundleId) {
      setExpandedBundleId(null)
      return
    }

    setExpandedBundleId(bundleId)

    // If we already have the data, don't fetch again
    if (bundleDetails[bundleId]) {
      return
    }

    // Fetch detailed bundle data
    setLoadingBundleId(bundleId)
    try {
      const data = await getKeyBundleDetails(bundleId, { includeLoans: true })
      if (data) {
        setBundleDetails((prev) => ({ ...prev, [bundleId]: data }))

        // Fetch key systems for this bundle
        const uniqueKeySystemIds = [
          ...new Set(
            data.keys
              .map((k) => k.keySystemId)
              .filter((id): id is string => id != null && id !== '')
          ),
        ]

        if (uniqueKeySystemIds.length > 0) {
          const keySystemMap: Record<string, string> = {}
          await Promise.all(
            uniqueKeySystemIds.map(async (id) => {
              try {
                const keySystem = await keyService.getKeySystem(id)
                keySystemMap[id] = keySystem.name
              } catch (error) {
                console.error(`Failed to fetch key system ${id}:`, error)
              }
            })
          )
          setKeySystemMaps((prev) => ({ ...prev, [bundleId]: keySystemMap }))
        }
      }
    } catch (error) {
      console.error('Error fetching bundle details:', error)
    } finally {
      setLoadingBundleId(null)
    }
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle className="text-base">
              Nyckelsamlingar med utlånade nycklar
              {hasLoaded && bundles.length > 0 && ` (${bundles.length})`}
            </CardTitle>
          </div>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bundles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Inga nyckelsamlingar har utlånade nycklar till denna kontakt
            </p>
          ) : (
            <div className="space-y-2">
              {bundles.map((bundle) => {
                const isExpanded = expandedBundleId === bundle.id
                const isLoadingDetails = loadingBundleId === bundle.id
                const details = bundleDetails[bundle.id]

                // Filter keys that are loaned to this contact
                const loanedKeys =
                  details?.keys.filter((key) =>
                    key.loans?.some(
                      (loan) =>
                        loan.loanType === 'MAINTENANCE' &&
                        loan.contact === contactCode &&
                        !loan.returnedAt
                    )
                  ) || []

                // Get key system map for this bundle (fetched in handleBundleExpand)
                const keySystemMap = keySystemMaps[bundle.id] || {}

                return (
                  <div key={bundle.id} className="rounded-lg border">
                    {/* Bundle Header */}
                    <div className="flex items-center justify-between p-3 transition-colors group">
                      {/* Left side - expandable to show keys */}
                      <div
                        className="flex-1 flex items-center gap-2 cursor-pointer hover:bg-muted/50 -m-3 p-3 rounded-l-lg"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBundleExpand(bundle.id)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{bundle.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {bundle.loanedKeyCount}/{bundle.totalKeyCount}{' '}
                              nycklar utlånade
                            </Badge>
                          </div>
                          {bundle.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {bundle.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right side - navigate to bundle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onBundleClick(bundle.id)
                        }}
                        className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors shrink-0"
                      >
                        Visa samling
                      </button>
                    </div>

                    {/* Expanded Keys List */}
                    {isExpanded && (
                      <div className="border-t px-3 pb-3">
                        {isLoadingDetails ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : loanedKeys.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Inga nycklar hittades
                          </p>
                        ) : (
                          <div className="mt-3">
                            <MaintenanceKeysTable
                              keys={loanedKeys}
                              keySystemMap={keySystemMap}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
