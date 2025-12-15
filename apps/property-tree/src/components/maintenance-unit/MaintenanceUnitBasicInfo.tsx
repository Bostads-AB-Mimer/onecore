import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { useIsMobile } from '../hooks/useMobile'
import { components } from '@/services/api/core/generated/api-types'

interface MaintenanceUnitBasicInfoProps {
  maintenanceUnit: components['schemas']['MaintenanceUnit']
}

export const MaintenanceUnitBasicInfo = ({
  maintenanceUnit,
}: MaintenanceUnitBasicInfoProps) => {
  const isMobile = useIsMobile()

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {maintenanceUnit.caption || maintenanceUnit.code}
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
              <p className="font-medium">
                {maintenanceUnit.rentalPropertyId || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kod</p>
              <p className="font-medium">{maintenanceUnit.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Typ</p>
              <p className="font-medium">{maintenanceUnit.type || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
