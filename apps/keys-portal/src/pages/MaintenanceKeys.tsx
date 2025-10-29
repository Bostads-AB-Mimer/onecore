import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { useContactCodeSearch } from '@/components/maintenance/ContactCodeSearch'
import { ContactAutocomplete } from '@/components/maintenance/ContactAutocomplete'
import { ContactInfoCard } from '@/components/loan/ContactInfoCard'
import { MaintenanceLoanCard } from '@/components/maintenance/MaintenanceLoanCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  Contact,
  KeyLoanMaintenanceKeysWithDetails,
} from '@/services/types'
import { maintenanceKeysService } from '@/services/api/maintenanceKeysService'
import { useToast } from '@/hooks/use-toast'

export default function MaintenanceKeys() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [activeLoans, setActiveLoans] = useState<
    KeyLoanMaintenanceKeysWithDetails[]
  >([])
  const [returnedLoans, setReturnedLoans] = useState<
    KeyLoanMaintenanceKeysWithDetails[]
  >([])
  const [loansLoading, setLoansLoading] = useState(false)
  const [activeLoansOpen, setActiveLoansOpen] = useState(true)
  const [returnedLoansOpen, setReturnedLoansOpen] = useState(false)
  const [hasLoadedActive, setHasLoadedActive] = useState(false)
  const [hasLoadedReturned, setHasLoadedReturned] = useState(false)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const { toast } = useToast()

  const scrollToResults = () =>
    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    )

  const handleResultFound = (contact: Contact | null, searchValue: string) => {
    setSelectedContact(contact)

    // Update URL params
    setSearchParams({ contact: searchValue })

    scrollToResults()
  }

  const handleClearSearch = () => {
    setSelectedContact(null)
    setActiveLoans([])
    setReturnedLoans([])
    setHasLoadedActive(false)
    setHasLoadedReturned(false)
    setSearchParams({})
  }

  // Fetch active loans when the section is opened (default open, so fetches immediately)
  useEffect(() => {
    if (!selectedContact || !activeLoansOpen) {
      return
    }

    const fetchActiveLoans = async () => {
      setLoansLoading(true)
      try {
        const active = await maintenanceKeysService.getByCompanyWithKeys(
          selectedContact.contactCode,
          false
        )
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
  }, [selectedContact, activeLoansOpen, toast])

  // Fetch returned loans when the section is opened
  useEffect(() => {
    if (!selectedContact || !returnedLoansOpen) {
      return
    }

    const fetchReturnedLoans = async () => {
      try {
        const returned = await maintenanceKeysService.getByCompanyWithKeys(
          selectedContact.contactCode,
          true
        )
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
  }, [selectedContact, returnedLoansOpen, toast])

  const { handleContactSelect, loading } = useContactCodeSearch({
    onResultFound: handleResultFound,
  })

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-2xl mx-auto">
        <ContactAutocomplete onSelect={handleContactSelect} loading={loading} />
      </div>

      {/* Show results when contact is found */}
      {selectedContact && (
        <div ref={resultsRef} className="border-t pt-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Sökresultat</h2>
              <Button variant="outline" size="sm" onClick={handleClearSearch}>
                <X className="h-4 w-4 mr-2" />
                Rensa sökning
              </Button>
            </div>

            {/* Contact Information */}
            <div className="max-w-2xl">
              <ContactInfoCard contacts={[selectedContact]} />
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

                {/* No Loans Found */}
                {activeLoans.length === 0 && returnedLoans.length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-center">
                        Inga lån hittades för detta företag.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
