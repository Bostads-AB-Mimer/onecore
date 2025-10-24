import { X, User, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { Tenant, Lease, TenantAddress as Address } from '@/services/types'
import { useMemo } from 'react'
import { ContractCard } from './ContractCard'
import { KeyNoteDisplay } from './KeyNoteDisplay'
import { deriveDisplayStatus, pickEndDate } from '@/lib/lease-status'

function formatAddress(addr?: Address): string {
  if (!addr) return 'Okänd adress'
  const line1 = [addr.street, addr.number].filter(Boolean).join(' ').trim()
  const line2 = [addr.postalCode, addr.city].filter(Boolean).join(' ').trim()
  return [line1, line2].filter(Boolean).join(', ') || 'Okänd adress'
}

const toMs = (d?: string) => (d ? new Date(d).getTime() : 0)

export function TenantInfo({
  tenant,
  contracts,
  onClearSearch,
  showTenantCard = true,
  searchType = null,
}: {
  tenant?: Tenant | null
  contracts: Lease[]
  onClearSearch: () => void
  /* hiding the tenant card for hyresobjekt flow */
  showTenantCard?: boolean
  searchType?: 'pnr' | 'object' | 'contactCode' | null
}) {
  // Get all tenants from the active lease for display
  const activeLease = useMemo(() => {
    return contracts.find((c) => deriveDisplayStatus(c) === 'active')
  }, [contracts])

  const tenantsToDisplay = useMemo(() => {
    // If we have an active lease, show all its tenants
    if (activeLease?.tenants?.length) {
      return activeLease.tenants
    }
    // Fallback to single tenant if provided
    return tenant ? [tenant] : []
  }, [activeLease, tenant])
  const {
    activeContracts,
    upcomingContracts,
    endedRecentContracts,
    endedOlderContracts,
  } = useMemo(() => {
    const active: Lease[] = []
    const upcoming: Lease[] = []
    const ended: Lease[] = []

    contracts.forEach((c) => {
      const s = deriveDisplayStatus(c)
      if (s === 'active') active.push(c)
      else if (s === 'upcoming') upcoming.push(c)
      else ended.push(c)
    })

    ended.sort((a, b) => toMs(pickEndDate(b)) - toMs(pickEndDate(a)))

    const cutoff = (() => {
      const d = new Date()
      d.setMonth(d.getMonth() - 2)
      return d.getTime()
    })()

    const endedRecent: Lease[] = []
    const endedOlder: Lease[] = []

    ended.forEach((lease) => {
      const endMs = toMs(pickEndDate(lease))
      if (endMs && endMs >= cutoff) endedRecent.push(lease)
      else endedOlder.push(lease)
    })

    return {
      activeContracts: active,
      upcomingContracts: upcoming,
      endedRecentContracts: endedRecent,
      endedOlderContracts: endedOlder,
    }
  }, [contracts])

  const totalEnded = endedRecentContracts.length + endedOlderContracts.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Sökresultat</h2>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          <X className="h-4 w-4 mr-2" />
          Rensa sökning
        </Button>
      </div>

      {/* Two-column layout: Tenant info on left, Notes on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Tenant card */}
        <div>
          {/* Show "No active tenant" message for object searches without active tenants */}
          {searchType === 'object' &&
            showTenantCard &&
            tenantsToDisplay.length === 0 &&
            activeContracts.length === 0 &&
            upcomingContracts.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Hyresgäst
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Inget aktivt hyresgäst
                  </p>
                </CardContent>
              </Card>
            )}

          {/* Show tenant card for PNR/contactCode searches, or object searches with active tenants */}
          {showTenantCard && tenantsToDisplay.length > 0 && (
            <Card id="tenant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Hyresgäst{tenantsToDisplay.length > 1 ? 'er' : ''}
                  {activeContracts.length === 0 &&
                    upcomingContracts.length === 0 && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-muted-foreground"
                      >
                        Inget aktivt kontrakt
                      </Badge>
                    )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={
                    tenantsToDisplay.length > 1
                      ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
                      : ''
                  }
                >
                  {tenantsToDisplay.map((t, idx) => {
                    // Use firstName+lastName if available, otherwise fallback to fullName
                    const name = [t.firstName, t.lastName]
                      .filter(Boolean)
                      .join(' ')
                    const displayName = name || t.fullName || 'Okänt namn'
                    return (
                      <div key={t.contactKey || idx} className="space-y-2">
                        {tenantsToDisplay.length > 1 && (
                          <h3 className="font-semibold text-sm">
                            Kontakt {idx + 1}: {displayName}
                          </h3>
                        )}
                        {tenantsToDisplay.length === 1 && (
                          <h3 className="font-semibold">{displayName}</h3>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Personnummer: {t.nationalRegistrationNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Kundnummer: {t.contactCode}
                        </p>
                        {t.emailAddress && (
                          <p className="text-sm text-muted-foreground">
                            E-post: {t.emailAddress}
                          </p>
                        )}
                        {t.phoneNumbers?.[0]?.phoneNumber && (
                          <p className="text-sm text-muted-foreground">
                            Telefon: {t.phoneNumbers[0].phoneNumber}
                          </p>
                        )}
                        {t.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {formatAddress(t.address as Address)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Notes display */}
        <div>
          {contracts.length > 0 && (
            <KeyNoteDisplay leases={contracts} searchType={searchType} />
          )}
        </div>
      </div>

      <div className="space-y-4">
        {activeContracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">
                Aktiva kontrakt ({activeContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeContracts.map((lease) => (
                <ContractCard key={lease.leaseId} lease={lease} />
              ))}
            </CardContent>
          </Card>
        )}

        {upcomingContracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">
                Kommande kontrakt ({upcomingContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingContracts.map((lease) => (
                <ContractCard key={lease.leaseId} lease={lease} />
              ))}
            </CardContent>
          </Card>
        )}

        {totalEnded > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">
                Avslutade kontrakt ({totalEnded})
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {endedRecentContracts.length > 0 && (
                <div className="space-y-4">
                  {endedRecentContracts.map((lease) => (
                    <ContractCard key={lease.leaseId} lease={lease} />
                  ))}
                </div>
              )}

              {endedOlderContracts.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="older-ended">
                    <AccordionTrigger
                      className="
                        w-full h-14 px-6 text-lg font-semibold
                        rounded-lg border shadow-sm justify-between
                        hover:bg-muted transition-colors
                        data-[state=open]:bg-muted
                        [&>svg]:h-6 [&>svg]:w-6
                      "
                    >
                      <span>Äldre avslutade kontrakt</span>
                      <span className="inline-flex items-center gap-3">
                        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm"></span>
                      </span>
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="space-y-4 pt-3">
                        {endedOlderContracts.map((lease) => (
                          <ContractCard key={lease.leaseId} lease={lease} />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </CardContent>
          </Card> // ← and this Card was never closed
        )}

        {activeContracts.length === 0 &&
          upcomingContracts.length === 0 &&
          totalEnded === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Inga kontrakt att visa.
                </p>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  )
}
