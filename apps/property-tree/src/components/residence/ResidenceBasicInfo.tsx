import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { ResidenceDetails } from '@/services/types'
import { useIsMobile } from '../hooks/useMobile'

interface ResidenceBasicInfoProps {
  residence: ResidenceDetails
}

export const ResidenceBasicInfo = ({ residence }: ResidenceBasicInfoProps) => {
  const isMobile = useIsMobile()

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          Lägenhet {residence.code}
        </h1>
        <p className="text-muted-foreground">
          {/* {property?.replace('-', ' ')}, {district} */}
          Byggnad/Fastighet: N/A
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Grundinformation</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`grid ${isMobile ? 'grid-cols-1 gap-y-4' : 'grid-cols-2 md:grid-cols-3 gap-4'}`}
          >
            <div>
              <p className="text-sm text-muted-foreground">Lägenhetskod</p>
              <p className="font-medium">{residence.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Namn</p>
              <p className="font-medium">
                {residence.residenceType.name}, {residence.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">
                {residence.deleted ? 'Borttagen' : 'Aktiv'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Yta</p>
              <p className="font-medium">
                N/A
                {/* {residence.size ? `${residence.size} m²` : '-'} */}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Anläggnings ID Mälarenergi
              </p>
              <p className="font-medium">
                {/* {residence.malarenergiFacilityId || '-'} */}
                N/A
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Befintligt kontrakt från
              </p>
              <p className="font-medium">
                {new Date(residence.validityPeriod.fromDate).toLocaleDateString(
                  'sv-SE'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Befintligt kontrakt till
              </p>
              <p className="font-medium">
                {new Date(residence.validityPeriod.toDate).toLocaleDateString(
                  'sv-SE'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
