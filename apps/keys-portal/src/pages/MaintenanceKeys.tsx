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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { KeyLoanMaintenanceKeysWithDetails } from '@/services/types'
import { maintenanceKeysService } from '@/services/api/maintenanceKeysService'
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
        } else if (searchResult.type === 'bundle' && searchResult.bundleId) {
          active = await maintenanceKeysService.getByBundleWithKeys(
            searchResult.bundleId,
            false
          )
        }

        setActiveLoans(active)
        setHasLoadedActive(true)
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
        } else if (searchResult.type === 'bundle' && searchResult.bundleId) {
          returned = await maintenanceKeysService.getByBundleWithKeys(
            searchResult.bundleId,
            true
          )
        }

        setReturnedLoans(returned)
        setHasLoadedReturned(true)
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
            <div className="max-w-2xl">
              {searchResult.type === 'contact' && searchResult.contact && (
                <ContactInfoCard contacts={[searchResult.contact]} />
              )}
              {searchResult.type === 'bundle' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle>{searchResult.bundleName}</CardTitle>
                      <Badge variant="outline">Nyckelsamling</Badge>
                    </div>
                  </CardHeader>
                </Card>
              )}
            </div>

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
                            <MaintenanceLoanCard key={loan.id} loan={loan} />
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
                            <MaintenanceLoanCard key={loan.id} loan={loan} />
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
