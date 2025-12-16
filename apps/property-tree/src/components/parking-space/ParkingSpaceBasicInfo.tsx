import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { useIsMobile } from '../hooks/useMobile'
import { components } from '@/services/api/core/generated/api-types'
import { Loader2 } from 'lucide-react'

interface ParkingSpaceBasicInfoProps {
  parkingSpace: components['schemas']['ParkingSpace']
  rent?: number
  isLoadingRent?: boolean
}

export const ParkingSpaceBasicInfo = ({
  parkingSpace,
  rent,
  isLoadingRent,
}: ParkingSpaceBasicInfoProps) => {
  const isMobile = useIsMobile()

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          Parkering {parkingSpace.parkingSpace.parkingNumber}
        </h1>
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
              <p className="text-sm text-muted-foreground">Adress</p>
              <p className="font-medium">
                {parkingSpace.parkingSpace.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Parkeringsplatstyp
              </p>
              <p className="font-medium">
                {parkingSpace.parkingSpace.parkingSpaceType.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Objektsnummer</p>
              <p className="font-medium">{parkingSpace.rentalId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">
                {isLoadingRent ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laddar...
                  </span>
                ) : rent ? (
                  'Uthyrd'
                ) : (
                  'Vakant'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Månadshyra</p>
              <p className="font-medium">
                {isLoadingRent ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laddar...
                  </span>
                ) : rent ? (
                  `${Math.round(rent).toLocaleString('sv-SE')} kr/mån`
                ) : (
                  '-'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
