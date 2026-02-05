import type { Building } from '@/types/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/Button'
import { useNavigate, useLocation } from 'react-router-dom'

interface PropertyBuildingCardProps {
  building: Building
}

export const PropertyBuildingCard = ({
  building,
}: PropertyBuildingCardProps) => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const companyId = state?.companyId

  const handleOpenBuilding = () => {
    // Create a URL-friendly building name
    navigate(`/buildings/${building.id}`, { state: { companyId } })
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
