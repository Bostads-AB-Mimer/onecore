import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { UnifiedMaintenanceSearch } from '@/components/maintenance/UnifiedMaintenanceSearch'
import {
  useUnifiedMaintenanceSearch,
  type SearchResult,
} from '@/components/maintenance/UnifiedMaintenanceSearchHook'
import { ContactInfoCard } from '@/components/loan/ContactInfoCard'
import { MaintenanceLoansTable } from '@/components/maintenance/MaintenanceLoansTable'
import { LoanMaintenanceKeysDialog } from '@/components/maintenance/dialogs/LoanMaintenanceKeysDialog'
import { ReturnMaintenanceKeysDialog } from '@/components/maintenance/dialogs/ReturnMaintenanceKeysDialog'
import { CreateLoanWithKeysCard } from '@/components/maintenance/CreateLoanWithKeysCard'
import { ContactBundlesWithLoanedKeysCard } from '@/components/maintenance/ContactBundlesWithLoanedKeysCard'
import { KeyBundleKeysTable } from '@/components/maintenance/KeyBundleKeysTable'
import { AddKeysToBundleCard } from '@/components/bundles/AddKeysToBundleCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InlineTextareaEditor } from '@/components/ui/inline-textarea-editor'
import { keyLoanService } from '@/services/api/keyLoanService'
import {
  getKeyBundleDetails,
  updateKeyBundle,
} from '@/services/api/keyBundleService'
import { keyService } from '@/services/api/keyService'
import type { KeyLoanWithDetails, KeyDetails, Contact } from '@/services/types'
import { useToast } from '@/hooks/use-toast'

export default function MaintenanceKeys() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [loans, setLoans] = useState<KeyLoanWithDetails[]>([])
  const [loansLoading, setLoansLoading] = useState(false)
  const [hasLoadedLoans, setHasLoadedLoans] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [bundleKeys, setBundleKeys] = useState<KeyDetails[]>([])
  const [bundleKeysLoading, setBundleKeysLoading] = useState(false)
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})
  const [loansKeySystemMap, setLoansKeySystemMap] = useState<
    Record<string, string>
  >({})
  const [preSelectedKeys, setPreSelectedKeys] = useState<KeyDetails[]>([])
  const [preSelectedCompany, setPreSelectedCompany] = useState<Contact | null>(
    null
  )
  const [contactLoanedKeyIds, setContactLoanedKeyIds] = useState<Set<string>>(
    new Set()
  )
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returnLoanId, setReturnLoanId] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const { toast } = useToast()

  const returnLoan = returnLoanId
    ? (loans.find((l) => l.id === returnLoanId) ?? null)
    : null

  const handleLoanReturn = (loanId: string) => {
    setReturnLoanId(loanId)
    setReturnDialogOpen(true)
  }

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
    setLoans([])
    setHasLoadedLoans(false)
    setContactLoanedKeyIds(new Set())
    setSearchParams({})
  }

  // Eagerly fetch loaned key IDs when a contact is selected
  useEffect(() => {
    if (
      !searchResult ||
      searchResult.type !== 'contact' ||
      !searchResult.contact
    ) {
      setContactLoanedKeyIds(new Set())
      return
    }

    const fetchLoanedKeyIds = async () => {
      try {
        const loans = await keyLoanService.getByContactWithKeys(
          searchResult.contact!.contactCode,
          undefined,
          false
        )
        setContactLoanedKeyIds(
          new Set(loans.flatMap((loan) => loan.keysArray.map((k) => k.id)))
        )
      } catch {
        setContactLoanedKeyIds(new Set())
      }
    }

    fetchLoanedKeyIds()
  }, [searchResult])

  // Fetch all loans when a search result is found
  useEffect(() => {
    if (!searchResult || hasLoadedLoans) {
      return
    }

    const fetchLoans = async () => {
      setLoansLoading(true)
      try {
        let allLoans: KeyLoanWithDetails[] = []

        if (searchResult.type === 'contact' && searchResult.contact) {
          allLoans = await keyLoanService.getByContactWithKeys(
            searchResult.contact.contactCode
          )
        } else if (searchResult.type === 'bundle' && searchResult.bundle) {
          allLoans = await keyLoanService.getByBundleWithKeys(
            searchResult.bundle.id
          )
        }

        setLoans(allLoans)
        setHasLoadedLoans(true)

        // Fetch key systems for the keys in all loans
        const allKeys = allLoans.flatMap((loan) => loan.keysArray)
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
          title: 'Kunde inte hämta lån',
          description: 'Ett fel uppstod när lån skulle hämtas',
          variant: 'destructive',
        })
        console.error('Error fetching maintenance loans:', error)
      } finally {
        setLoansLoading(false)
      }
    }

    fetchLoans()
  }, [searchResult, hasLoadedLoans, toast])

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
        const data = await getKeyBundleDetails(searchResult.bundle!.id, {
          includeLoans: true,
          includeEvents: true,
          includeKeySystem: true,
        })
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

  const {
    handleSelectContact,
    handleSelectBundle,
    handleSearchByBundleId,
    loading,
  } = useUnifiedMaintenanceSearch({
    onResultFound: handleResultFound,
  })

  // Handle deep-linking: trigger search from URL params on initial mount only
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const contactParam = searchParams.get('contact')
    const bundleParam = searchParams.get('bundle')

    if (contactParam) {
      handleSelectContact(contactParam)
    } else if (bundleParam) {
      handleSearchByBundleId(bundleParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              <Button variant="outline" size="sm" onClick={handleClearSearch}>
                <X className="h-4 w-4 mr-2" />
                Rensa sökning
              </Button>
            </div>

            {/* Search Result Info */}
            {searchResult.type === 'contact' && searchResult.contact && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ContactInfoCard contacts={[searchResult.contact]} />
                  <CreateLoanWithKeysCard
                    loanedKeyIds={contactLoanedKeyIds}
                    onKeysSelected={(keys) => {
                      // Cast keys to KeyDetails[] - they don't have loan status since they're being selected for a new loan
                      const keysWithStatus = keys.map((k) => ({
                        ...k,
                        loan: null,
                        latestEvent: null,
                      })) as KeyDetails[]
                      setPreSelectedKeys(keysWithStatus)
                      setPreSelectedCompany(searchResult.contact!)
                      setCreateDialogOpen(true)
                    }}
                  />
                </div>
                <ContactBundlesWithLoanedKeysCard
                  contactCode={searchResult.contact.contactCode}
                  onBundleClick={(bundleId) => {
                    setHasLoadedLoans(false)
                    handleSearchByBundleId(bundleId)
                  }}
                />
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
                        const data = await getKeyBundleDetails(
                          searchResult.bundle!.id,
                          {
                            includeLoans: true,
                            includeEvents: true,
                            includeKeySystem: true,
                          }
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
                <Card>
                  <CardHeader>
                    <CardTitle>Nycklar i {searchResult.bundle.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Totalt {bundleKeys.length} nycklar
                    </p>
                  </CardHeader>
                  <CardContent>
                    <KeyBundleKeysTable
                      keys={bundleKeys}
                      bundleId={searchResult.bundle.id}
                      onRefresh={async () => {
                        try {
                          setBundleKeysLoading(true)
                          const data = await getKeyBundleDetails(
                            searchResult.bundle!.id,
                            {
                              includeLoans: true,
                              includeEvents: true,
                              includeKeySystem: true,
                            }
                          )
                          if (data) {
                            setBundleKeys(data.keys)

                            // Fetch key systems for the keys
                            const uniqueKeySystemIds = [
                              ...new Set(
                                data.keys
                                  .map((k) => k.keySystemId)
                                  .filter(
                                    (id): id is string =>
                                      id != null && id !== ''
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
                  </CardContent>
                </Card>
              ))}

            {/* Loading State */}
            {loansLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Laddar lån...
              </div>
            )}

            {/* Loans Display */}
            {!loansLoading && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Lån
                    {hasLoadedLoans && ` (${loans.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <MaintenanceLoansTable
                    loans={loans}
                    keySystemMap={loansKeySystemMap}
                    emptyMessage="Inga lån"
                    onLoanReturned={handleLoanReturn}
                    onLoanUpdated={() => setHasLoadedLoans(false)}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Return Loan Dialog */}
      {returnLoan && (
        <ReturnMaintenanceKeysDialog
          open={returnDialogOpen}
          onOpenChange={(open) => {
            setReturnDialogOpen(open)
            if (!open) setReturnLoanId(null)
          }}
          keyIds={returnLoan.keysArray.map((k) => k.id)}
          cardIds={(returnLoan.keyCardsArray || []).map((c) => c.cardId)}
          allKeys={returnLoan.keysArray}
          allCards={returnLoan.keyCardsArray || []}
          onSuccess={() => {
            setReturnDialogOpen(false)
            setReturnLoanId(null)
            setHasLoadedLoans(false)
          }}
        />
      )}

      {/* Create Loan Dialog - only for contact searches */}
      {searchResult?.type === 'contact' && searchResult.contact && (
        <LoanMaintenanceKeysDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open)
            if (!open) {
              // Clear pre-selected keys and company when dialog closes
              setPreSelectedKeys([])
              setPreSelectedCompany(null)
            }
          }}
          keys={preSelectedKeys}
          preSelectedCompany={preSelectedCompany || undefined}
          onSuccess={() => {
            // Refresh loans after creating a new one
            setHasLoadedLoans(false)
            setPreSelectedKeys([])
            setPreSelectedCompany(null)
          }}
        />
      )}
    </div>
  )
}
