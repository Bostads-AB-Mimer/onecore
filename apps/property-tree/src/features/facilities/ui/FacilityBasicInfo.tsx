import { Loader2 } from 'lucide-react'

import { components } from '@/services/api/core/generated/api-types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

interface FacilityBasicInfoProps {
  facility: components['schemas']['FacilityDetails']
  rent?: number
  isRented?: boolean
  isLoadingLease?: boolean
}

export const FacilityBasicInfo = ({
  facility,
  rent,
  isRented,
  isLoadingLease,
}: FacilityBasicInfoProps) => {
  const isMobile = useIsMobile()

  return (
    <>
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
              <p className="font-medium">{facility.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hyresobjektstyp</p>
              <p className="font-medium">
                {facility.rentalInformation?.type.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Objektsnummer</p>
              <p className="font-medium">
                {facility.rentalInformation?.rentalId || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Typ</p>
              <p className="font-medium">{facility.type.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">
                {isLoadingLease ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laddar...
                  </span>
                ) : isRented ? (
                  'Uthyrd'
                ) : (
                  'Vakant'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Yta</p>
              <p className="font-medium">
                {facility.areaSize ? `${facility.areaSize} m²` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Månadshyra</p>
              <p className="font-medium">
                {isLoadingLease ? (
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
