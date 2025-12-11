import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { useIsMobile } from '../hooks/useMobile'
import { components } from '@/services/api/core/generated/api-types'

interface ParkingSpaceBasicInfoProps {
  parkingSpace: components['schemas']['ParkingSpace']
}

export const ParkingSpaceBasicInfo = ({
  parkingSpace,
}: ParkingSpaceBasicInfoProps) => {
  const isMobile = useIsMobile()

  // Format address
  const formatAddress = () => {
    const parts = [
      parkingSpace.address.streetAddress,
      parkingSpace.address.streetAddress2,
      parkingSpace.address.postalCode,
      parkingSpace.address.city,
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(', ') : '-'
  }

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
              <p className="text-sm text-muted-foreground">Hyres ID</p>
              <p className="font-medium">{parkingSpace.rentalId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Adress</p>
              <p className="font-medium">{formatAddress()}</p>
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
              <p className="text-sm text-muted-foreground">Parkeringsnummer</p>
              <p className="font-medium">
                {parkingSpace.parkingSpace.parkingNumber}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kod</p>
              <p className="font-medium">{parkingSpace.parkingSpace.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Namn</p>
              <p className="font-medium">
                {parkingSpace.parkingSpace.name || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
