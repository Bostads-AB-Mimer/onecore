import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { TabLayout } from '@/shared/ui/TabLayout'
import {
  InfoIcon,
  Home,
  Car,
  Users,
  ExternalLink,
  Plus,
  Loader2,
} from 'lucide-react'
import { ApplicationProfileDisplay } from './ApplicationProfileDisplay'
import { useInterestApplications } from '../hooks/useInterestApplications'
import { useApplicationProfile } from '../hooks/useApplicationProfile'
import { useContactQueuePoints } from '../hooks/useContactQueuePoints'
import { resolve } from '@/shared/lib/env'
import { formatISODate } from '@/shared/lib/formatters'

// Helper function to get status badge variant
// Handles both numeric ApplicantStatus enum values and string values
const getStatusBadge = (status: string | number) => {
  // Handle numeric ApplicantStatus enum values
  if (typeof status === 'number') {
    switch (status) {
      case 1: // Active - applicant is waiting in queue
        return { variant: 'outline' as const, className: '', text: 'Väntar' }
      case 2: // Assigned
        return {
          variant: 'default' as const,
          className: 'bg-green-500',
          text: 'Tilldelad',
        }
      case 3: // AssignedToOther
        return {
          variant: 'secondary' as const,
          className: '',
          text: 'Tilldelad till annan',
        }
      case 4: // WithdrawnByUser
        return {
          variant: 'secondary' as const,
          className: '',
          text: 'Återkallad av hyresgäst',
        }
      case 5: // WithdrawnByManager
        return {
          variant: 'secondary' as const,
          className: '',
          text: 'Återkallad',
        }
      case 6: // Offered
        return {
          variant: 'default' as const,
          className: 'bg-amber-500',
          text: 'Erbjuden',
        }
      case 7: // OfferAccepted
        return {
          variant: 'default' as const,
          className: 'bg-green-500',
          text: 'Erbjudande accepterat',
        }
      case 8: // OfferDeclined
        return {
          variant: 'secondary' as const,
          className: '',
          text: 'Erbjudande avböjt',
        }
      case 9: // OfferExpired
        return {
          variant: 'secondary' as const,
          className: '',
          text: 'Erbjudande utgånget',
        }
      default:
        return {
          variant: 'outline' as const,
          className: '',
          text: `Status ${status}`,
        }
    }
  }

  // Handle string status values (backwards compatibility)
  switch (status?.toLowerCase()) {
    case 'offered':
    case 'erbjuden':
      return {
        variant: 'default' as const,
        className: 'bg-amber-500',
        text: 'Erbjuden',
      }
    case 'active':
    case 'aktiv':
      return { variant: 'outline' as const, className: '', text: 'Aktiv' }
    case 'waiting':
    case 'väntar':
      return { variant: 'outline' as const, className: '', text: 'Väntar' }
    default:
      return { variant: 'outline' as const, className: '', text: status }
  }
}

interface TenantQueueSystemTabContentProps {
  contactCode: string
  tenantName: string
}

export function TenantQueueSystemTabContent({
  contactCode,
  tenantName,
}: TenantQueueSystemTabContentProps) {
  // Separate API calls - each loads independently
  const {
    data: queuePoints,
    isLoading: queuePointsLoading,
    error: queuePointsError,
  } = useContactQueuePoints(contactCode)

  const {
    data: interestApplications,
    isLoading: interestApplicationsLoading,
    error: interestApplicationsError,
  } = useInterestApplications(contactCode)

  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = useApplicationProfile(contactCode)

  const [activeInterests, setActiveInterests] = useState(
    interestApplications || []
  )

  // Update active interests when data changes
  useEffect(() => {
    if (interestApplications) {
      setActiveInterests(interestApplications)
    }
  }, [interestApplications])

  // Listen for new parking interest applications
  useEffect(() => {
    const handleNewInterest = (event: CustomEvent) => {
      // Refetch will be triggered by the mutation hook
      // This is just for real-time UI updates
      console.log('New parking interest created:', event.detail)
    }

    window.addEventListener(
      'parkingInterestCreated',
      handleNewInterest as EventListener
    )
    return () =>
      window.removeEventListener(
        'parkingInterestCreated',
        handleNewInterest as EventListener
      )
  }, [])

  // Handler to open Sökandeprofil in internal portal
  const handleOpenSokandeprofil = () => {
    const portalBaseUrl = resolve(
      'VITE_INTERNAL_PORTAL',
      'http://localhost:7003'
    )
    const sokprofilUrl = `${portalBaseUrl}/sokandeprofil?contact_code=${contactCode}`
    window.open(sokprofilUrl, '_blank')
  }

  // Handler to open Bilplatser in internal portal
  const handleOpenBilplatser = () => {
    const portalBaseUrl = resolve(
      'VITE_INTERNAL_PORTAL',
      'http://localhost:7003'
    )
    const bilplatserUrl = `${portalBaseUrl}/bilplatser`
    window.open(bilplatserUrl, '_blank')
  }

  return (
    <TabLayout title="Uthyrning" showCard={false}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Housing Queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="h-5 w-5 text-muted-foreground" />
              Bostadskö
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queuePointsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : queuePointsError ? (
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Kunde inte ladda köpoäng
                  </AlertDescription>
                </Alert>
              ) : queuePoints?.housing ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Köpoäng</p>
                    <p className="text-2xl font-bold">
                      {queuePoints.housing.queuePoints}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Motsvarar ca{' '}
                      {Math.floor(queuePoints.housing.queuePoints / 365)} år och{' '}
                      {queuePoints.housing.queuePoints % 365} dagar
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" disabled>
                    <Plus className="h-4 w-4 mr-2" />
                    Ny intresseanmälan bostad
                  </Button>
                </>
              ) : (
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Finns inga poäng att visa
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parking Queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5 text-muted-foreground" />
              Bilplatskö
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queuePointsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : queuePointsError ? (
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Kunde inte ladda köpoäng
                  </AlertDescription>
                </Alert>
              ) : queuePoints?.parking ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Köpoäng</p>
                    <p className="text-2xl font-bold">
                      {queuePoints.parking.queuePoints}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Motsvarar ca{' '}
                      {Math.floor(queuePoints.parking.queuePoints / 365)} år och{' '}
                      {queuePoints.parking.queuePoints % 365} dagar
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleOpenBilplatser}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visa tillgängliga bilplatser
                  </Button>
                </>
              ) : (
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Ingen köinformation tillgänglig
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Storage Queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="h-5 w-5 text-muted-foreground" />
              Förråd
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queuePointsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : queuePointsError ? (
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Kunde inte ladda köpoäng
                  </AlertDescription>
                </Alert>
              ) : queuePoints?.storage ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Köpoäng</p>
                    <p className="text-2xl font-bold">
                      {queuePoints.storage.queuePoints}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Motsvarar ca{' '}
                      {Math.floor(queuePoints.storage.queuePoints / 365)} år och{' '}
                      {queuePoints.storage.queuePoints % 365} dagar
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" disabled>
                    <Plus className="h-4 w-4 mr-2" />
                    Ny intresseanmälan förråd
                  </Button>
                </>
              ) : (
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Finns inga poäng att visa
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Housing References */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Boendereferenser
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profileLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : profileError ? (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Kunde inte ladda sökandeprofil
              </AlertDescription>
            </Alert>
          ) : profileData?.applicationProfile ? (
            <div className="space-y-4">
              <ApplicationProfileDisplay
                profile={profileData.applicationProfile}
              />
              <Button
                variant="outline"
                onClick={handleOpenSokandeprofil}
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Sökandeprofil
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Ingen sökandeprofil finns ännu. Klicka på knappen nedan för
                  att skapa en profil.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                onClick={handleOpenSokandeprofil}
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Sökandeprofil
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Interest Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Aktiva intresseanmälningar (Bilplatser)</CardTitle>
        </CardHeader>
        <CardContent>
          {interestApplicationsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Laddar intresseanmälningar...
              </span>
            </div>
          ) : interestApplicationsError ? (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Kunde inte ladda intresseanmälningar</AlertTitle>
              <AlertDescription>
                Ett fel uppstod vid hämtning av intresseanmälningar. Försök igen
                senare.
              </AlertDescription>
            </Alert>
          ) : activeInterests && activeInterests.length > 0 ? (
            <div className="space-y-4">
              {activeInterests.map((interest) => {
                const statusBadge = getStatusBadge(interest.status)
                return (
                  <div key={interest.id} className="border rounded-md p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <span className="font-medium">
                          {interest.address || `Ansökan #${interest.id}`}
                        </span>
                      </div>
                      <Badge
                        variant={statusBadge.variant}
                        className={statusBadge.className}
                      >
                        {statusBadge.text}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Anmäld: </span>
                        <span>{formatISODate(interest.applicationDate)}</span>
                      </div>
                      {interest.publishedTo && (
                        <div>
                          <span className="text-muted-foreground">
                            Publicerad tom:{' '}
                          </span>
                          <span>{formatISODate(interest.publishedTo)}</span>
                        </div>
                      )}
                      {interest.vacantFrom && (
                        <div>
                          <span className="text-muted-foreground">
                            Ledigt från:{' '}
                          </span>
                          <span>{formatISODate(interest.vacantFrom)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Inga aktiva intresseanmälningar</AlertTitle>
              <AlertDescription>
                Det finns inga aktiva intresseanmälningar för denna kund.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </TabLayout>
  )
}
