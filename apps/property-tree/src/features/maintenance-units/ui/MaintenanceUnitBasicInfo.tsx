import { components } from '@/services/api/core/generated/api-types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

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
              <p className="text-sm text-muted-foreground">Objektskod</p>
              <p className="font-medium">{maintenanceUnit.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Typ</p>
              <p className="font-medium">{maintenanceUnit.type || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fastighet</p>
              <p className="font-medium">{maintenanceUnit.estate || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
