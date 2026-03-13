import { useLocation, useNavigate } from 'react-router-dom'

import { paths } from '@/shared/routes'
import type { Building } from '@/shared/types/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

interface PropertyBuildingCardProps {
  building: Building
}

export const PropertyBuildingCard = ({
  building,
}: PropertyBuildingCardProps) => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const organizationNumber = state?.organizationNumber

  const handleOpenBuilding = () => {
    navigate(paths.building(building.code), {
      state: { organizationNumber },
    })
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{building.name}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="outline" size="sm" onClick={handleOpenBuilding}>
          Öppna byggnad
        </Button>
      </CardContent>
    </Card>
  )
}
