import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { UnifiedMaintenanceSearch } from '@/components/maintenance/UnifiedMaintenanceSearch'
import {
  useUnifiedMaintenanceSearch,
  type SearchResult,
} from '@/components/maintenance/UnifiedMaintenanceSearchHook'
import { ContactInfoCard } from '@/components/loan/ContactInfoCard'
import { MaintenanceLoanCard } from '@/components/maintenance/MaintenanceLoanCard'
import { CreateMaintenanceLoanDialog } from '@/components/maintenance/CreateMaintenanceLoanDialog'
import { KeyBundleKeysTable } from '@/components/maintenance/KeyBundleKeysTable'
import { AddKeysToBundleCard } from '@/components/bundles/AddKeysToBundleCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InlineTextareaEditor } from '@/components/ui/inline-textarea-editor'
import { maintenanceKeysService } from '@/services/api/maintenanceKeysService'
import {
  getKeyBundleWithLoanStatus,
  updateKeyBundle,
} from '@/services/api/keyBundleService'
import { keyService } from '@/services/api/keyService'
import type {
  KeyLoanMaintenanceKeysWithDetails,
  KeyWithMaintenanceLoanStatus,
} from '@/services/types'
import { useToast } from '@/hooks/use-toast'

export default function MaintenanceKeys() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [activeLoans, setActiveLoans] = useState<
    KeyLoanMaintenanceKeysWithDetails[]
  >([])
  const [returnedLoans, setReturnedLoans] = useState<
    KeyLoanMaintenanceKeysWithDetails[]
  >([])
  const [loansLoading, setLoansLoading] = useState(false)
  const [activeLoansOpen, setActiveLoansOpen] = useState(false)
  const [returnedLoansOpen, setReturnedLoansOpen] = useState(false)
  const [hasLoadedActive, setHasLoadedActive] = useState(false)
  const [hasLoadedReturned, setHasLoadedReturned] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [bundleKeys, setBundleKeys] = useState<KeyWithMaintenanceLoanStatus[]>(
    []
  )
  const [bundleKeysLoading, setBundleKeysLoading] = useState(false)
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})
  const [loansKeySystemMap, setLoansKeySystemMap] = useState<
    Record<string, string>
  >({})
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const { toast } = useToast()

  const scrollToResults = () =>
    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    )

  const handleResultFound = (result: SearchResult, searchValue: string) => {
    setSearchResult(result)

    // Update URL params based on search type
    if (result.type === 'contact') {
      setSearchParams({ contact: searchValue })
    } else {
      setSearchParams({ bundle: searchValue })
    }

    scrollToResults()
  }

  const handleClearSearch = () => {
    setSearchResult(null)
    setActiveLoans([])
    setReturnedLoans([])
    setHasLoadedActive(false)
    setHasLoadedReturned(false)
    setActiveLoansOpen(false)
    setReturnedLoansOpen(false)
    setSearchParams({})
  }

  // Fetch active loans when the section is opened
  useEffect(() => {
    if (!searchResult || !activeLoansOpen) {
      return
    }

    const fetchActiveLoans = async () => {
      setLoansLoading(true)
      try {
        let active: KeyLoanMaintenanceKeysWithDetails[] = []

        if (searchResult.type === 'contact' && searchResult.contact) {
          active = await maintenanceKeysService.getByCompanyWithKeys(
            searchResult.contact.contactCode,
            false
          )
        } else if (searchResult.type === 'bundle' && searchResult.bundle) {
          active = await maintenanceKeysService.getAllLoansForBundle(
            searchResult.bundle.id,
            false
          )
        }

        setActiveLoans(active)
        setHasLoadedActive(true)

        // Fetch key systems for the keys in active loans
        const allKeys = active.flatMap((loan) => loan.keysArray)
        const uniqueKeySystemIds = [
          ...new Set(
            allKeys
              .map((k) => k.keySystemId)
              .filter((id): id is string => id != null && id !== '')
          ),
        ]

        if (uniqueKeySystemIds.length > 0) {
          const systemMap: Record<string, string> = {}
          await Promise.all(
            uniqueKeySystemIds.map(async (id) => {
              try {
                const keySystem = await keyService.getKeySystem(id)
                systemMap[id] = keySystem.systemCode
              } catch (error) {
                console.error(`Failed to fetch key system ${id}:`, error)
              }
            })
          )
          setLoansKeySystemMap(systemMap)
        }
      } catch (error) {
        toast({
          title: 'Kunde inte hämta aktiva lån',
          description: 'Ett fel uppstod när aktiva lån skulle hämtas',
          variant: 'destructive',
        })
        console.error('Error fetching active maintenance loans:', error)
      } finally {
        setLoansLoading(false)
      }
    }

    fetchActiveLoans()
  }, [searchResult, activeLoansOpen, toast])

  // Fetch returned loans when the section is opened
  useEffect(() => {
    if (!searchResult || !returnedLoansOpen) {
      return
    }

    const fetchReturnedLoans = async () => {
      try {
        let returned: KeyLoanMaintenanceKeysWithDetails[] = []

        if (searchResult.type === 'contact' && searchResult.contact) {
          returned = await maintenanceKeysService.getByCompanyWithKeys(
            searchResult.contact.contactCode,
            true
          )
        } else if (searchResult.type === 'bundle' && searchResult.bundle) {
          returned = await maintenanceKeysService.getAllLoansForBundle(
            searchResult.bundle.id,
            true
          )
        }

        setReturnedLoans(returned)
        setHasLoadedReturned(true)

        // Fetch key systems for the keys in returned loans (merge with existing map)
        const allKeys = returned.flatMap((loan) => loan.keysArray)
        const uniqueKeySystemIds = [
          ...new Set(
            allKeys
              .map((k) => k.keySystemId)
              .filter((id): id is string => id != null && id !== '')
          ),
        ]

        if (uniqueKeySystemIds.length > 0) {
          const systemMap: Record<string, string> = {}
          await Promise.all(
            uniqueKeySystemIds.map(async (id) => {
              try {
                const keySystem = await keyService.getKeySystem(id)
                systemMap[id] = keySystem.systemCode
              } catch (error) {
                console.error(`Failed to fetch key system ${id}:`, error)
              }
            })
          )
          // Merge with existing loans key system map
          setLoansKeySystemMap((prev) => ({ ...prev, ...systemMap }))
        }
      } catch (error) {
        toast({
          title: 'Kunde inte hämta återlämnade lån',
          description: 'Ett fel uppstod när återlämnade lån skulle hämtas',
          variant: 'destructive',
        })
        console.error('Error fetching returned maintenance loans:', error)
      }
    }

    fetchReturnedLoans()
  }, [searchResult, returnedLoansOpen, toast])

  // Fetch bundle keys when a bundle is selected
  useEffect(() => {
    if (
      !searchResult ||
      searchResult.type !== 'bundle' ||
      !searchResult.bundle
    ) {
      setBundleKeys([])
      return
    }

    const fetchBundleKeys = async () => {
      setBundleKeysLoading(true)
      try {
        const data = await getKeyBundleWithLoanStatus(searchResult.bundle!.id)
        if (data) {
          setBundleKeys(data.keys)

          // Fetch key systems for the keys
          const uniqueKeySystemIds = [
            ...new Set(
              data.keys
                .map((k) => k.keySystemId)
                .filter((id): id is string => id != null && id !== '')
            ),
          ]

          if (uniqueKeySystemIds.length > 0) {
            const systemMap: Record<string, string> = {}
            await Promise.all(
              uniqueKeySystemIds.map(async (id) => {
                try {
                  const keySystem = await keyService.getKeySystem(id)
                  systemMap[id] = keySystem.systemCode
                } catch (error) {
                  console.error(`Failed to fetch key system ${id}:`, error)
                }
              })
            )
            setKeySystemMap(systemMap)
          } else {
            setKeySystemMap({})
          }
        }
      } catch (error) {
        toast({
          title: 'Kunde inte hämta nycklar',
          description: 'Ett fel uppstod när nycklar skulle hämtas',
          variant: 'destructive',
        })
        console.error('Error fetching bundle keys:', error)
      } finally {
        setBundleKeysLoading(false)
      }
    }

    fetchBundleKeys()
  }, [searchResult, toast])

  const { handleSelectContact, handleSelectBundle, loading } =
    useUnifiedMaintenanceSearch({
      onResultFound: handleResultFound,
    })

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-2xl mx-auto">
        <UnifiedMaintenanceSearch
          onSelectContact={handleSelectContact}
          onSelectBundle={handleSelectBundle}
          loading={loading}
        />
      </div>

      {/* Show results when search is performed */}
      {searchResult && (
        <div ref={resultsRef} className="border-t pt-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Sökresultat</h2>
              <div className="flex items-center gap-2">
                {searchResult.type === 'contact' && searchResult.contact && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nytt lån
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleClearSearch}>
                  <X className="h-4 w-4 mr-2" />
                  Rensa sökning
                </Button>
              </div>
            </div>

            {/* Search Result Info */}
            {searchResult.type === 'contact' && searchResult.contact && (
              <div className="max-w-2xl">
                <ContactInfoCard contacts={[searchResult.contact]} />
              </div>
            )}
            {searchResult.type === 'bundle' && searchResult.bundle && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle>{searchResult.bundle.name}</CardTitle>
                      <Badge variant="outline">Nyckelsamling</Badge>
                    </div>
                    <InlineTextareaEditor
                      value={searchResult.bundle.description ?? ''}
                      onSave={async (newValue) => {
                        const updatedBundle = await updateKeyBundle(
                          searchResult.bundle!.id,
                          {
                            description: newValue,
                          }
                        )
                        setSearchResult({
                          ...searchResult,
                          bundle: updatedBundle,
                        })
                        toast({
                          title: 'Beskrivning uppdaterad',
                          description:
                            'Nyckelsamlingens beskrivning har uppdaterats',
                        })
                      }}
                      placeholder="Lägg till beskrivning..."
                      emptyText="Klicka för att lägga till beskrivning"
                      rows={4}
                      className="mt-2 text-sm text-muted-foreground hover:text-foreground"
                    />
                  </CardHeader>
                </Card>
                <AddKeysToBundleCard
                  bundle={searchResult.bundle}
                  currentKeyIds={bundleKeys.map((k) => k.id)}
                  onKeysAdded={() => {
                    // Refetch bundle keys after adding
                    const fetchBundleKeys = async () => {
                      try {
                        const data = await getKeyBundleWithLoanStatus(
                          searchResult.bundle!.id
                        )
                        if (data) {
                          setBundleKeys(data.keys)

                          // Fetch key systems for the keys
                          const uniqueKeySystemIds = [
                            ...new Set(
                              data.keys
                                .map((k) => k.keySystemId)
                                .filter(
                                  (id): id is string => id != null && id !== ''
                                )
                            ),
                          ]

                          if (uniqueKeySystemIds.length > 0) {
                            const systemMap: Record<string, string> = {}
                            await Promise.all(
                              uniqueKeySystemIds.map(async (id) => {
                                try {
                                  const keySystem =
                                    await keyService.getKeySystem(id)
                                  systemMap[id] = keySystem.systemCode
                                } catch (error) {
                                  console.error(
                                    `Failed to fetch key system ${id}:`,
                                    error
                                  )
                                }
                              })
                            )
                            setKeySystemMap(systemMap)
                          } else {
                            setKeySystemMap({})
                          }
                        }
                      } catch (error) {
                        console.error('Error refetching bundle keys:', error)
                      }
                    }
                    fetchBundleKeys()
                  }}
                />
              </div>
            )}

            {/* Bundle Keys Table */}
            {searchResult.type === 'bundle' &&
              searchResult.bundle &&
              (bundleKeysLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Laddar nycklar...
                </div>
              ) : (
                <KeyBundleKeysTable
                  keys={bundleKeys}
                  bundleName={searchResult.bundle.name}
                  bundleId={searchResult.bundle.id}
                  onRefresh={async () => {
                    try {
                      setBundleKeysLoading(true)
                      const data = await getKeyBundleWithLoanStatus(
                        searchResult.bundle!.id
                      )
                      if (data) {
                        setBundleKeys(data.keys)

                        // Fetch key systems for the keys
                        const uniqueKeySystemIds = [
                          ...new Set(
                            data.keys
                              .map((k) => k.keySystemId)
                              .filter(
                                (id): id is string => id != null && id !== ''
                              )
                          ),
                        ]

                        if (uniqueKeySystemIds.length > 0) {
                          const systemMap: Record<string, string> = {}
                          await Promise.all(
                            uniqueKeySystemIds.map(async (id) => {
                              try {
                                const keySystem =
                                  await keyService.getKeySystem(id)
                                systemMap[id] = keySystem.systemCode
                              } catch (error) {
                                console.error(
                                  `Failed to fetch key system ${id}:`,
                                  error
                                )
                              }
                            })
                          )
                          setKeySystemMap(systemMap)
                        } else {
                          setKeySystemMap({})
                        }
                      }
                    } catch (error) {
                      console.error('Error refetching bundle keys:', error)
                    } finally {
                      setBundleKeysLoading(false)
                    }
                  }}
                />
              ))}

            {/* Loading State */}
            {loansLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Laddar lån...
              </div>
            )}

            {/* Loans Display */}
            {!loansLoading && (
              <>
                {/* Active Loans - Always show header */}
                <Card>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setActiveLoansOpen(!activeLoansOpen)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-green-600">
                        Aktiva lån
                        {hasLoadedActive && ` (${activeLoans.length})`}
                      </CardTitle>
                      {activeLoansOpen ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  {activeLoansOpen && (
                    <>
                      {activeLoans.length > 0 ? (
                        <CardContent className="space-y-4">
                          {activeLoans.map((loan) => (
                            <MaintenanceLoanCard
                              key={loan.id}
                              loan={loan}
                              keySystemMap={loansKeySystemMap}
                            />
                          ))}
                        </CardContent>
                      ) : (
                        <CardContent>
                          <p className="text-muted-foreground text-center text-sm">
                            Inga aktiva lån
                          </p>
                        </CardContent>
                      )}
                    </>
                  )}
                </Card>

                {/* Returned Loans - Always show header */}
                <Card>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setReturnedLoansOpen(!returnedLoansOpen)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-muted-foreground">
                        Återlämnade lån
                        {hasLoadedReturned && ` (${returnedLoans.length})`}
                      </CardTitle>
                      {returnedLoansOpen ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  {returnedLoansOpen && (
                    <>
                      {returnedLoans.length > 0 ? (
                        <CardContent className="space-y-4">
                          {returnedLoans.map((loan) => (
                            <MaintenanceLoanCard
                              key={loan.id}
                              loan={loan}
                              keySystemMap={loansKeySystemMap}
                            />
                          ))}
                        </CardContent>
                      ) : (
                        <CardContent>
                          <p className="text-muted-foreground text-center text-sm">
                            Inga återlämnade lån
                          </p>
                        </CardContent>
                      )}
                    </>
                  )}
                </Card>

                {/* No Loans Found - only show if we've checked both sections */}
                {hasLoadedActive &&
                  hasLoadedReturned &&
                  activeLoans.length === 0 &&
                  returnedLoans.length === 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-muted-foreground text-center">
                          {searchResult.type === 'contact'
                            ? 'Inga lån hittades för detta företag.'
                            : 'Inga lån hittades för denna nyckelsamling.'}
                        </p>
                      </CardContent>
                    </Card>
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Loan Dialog - only for contact searches */}
      {searchResult?.type === 'contact' && searchResult.contact && (
        <CreateMaintenanceLoanDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          companyContactCode={searchResult.contact.contactCode}
          companyName={
            searchResult.contact.fullName || searchResult.contact.contactCode
          }
          onSuccess={() => {
            // Refresh active loans after creating a new one
            setHasLoadedActive(false)
            setActiveLoansOpen(true)
          }}
        />
      )}
    </div>
  )
}
