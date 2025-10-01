import { Building } from '@/types/api'
import { Card, CardContent } from '@/components/ui/v2/Card'
import {
  Building as BuildingIcon,
  CalendarDays,
  Layers,
  SquareStack,
  Users,
} from 'lucide-react'

interface BuildingInfoProps {
  building: Building
}

export const BuildingInfo = ({ building }: BuildingInfoProps) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Byggnadsdetaljer</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-3">
                <BuildingIcon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-muted-foreground text-sm">Area</span>
              <span className="text-2xl font-bold">{building.area} m²</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-3">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <span className="text-muted-foreground text-sm">Våningar</span>
              <span className="text-2xl font-bold">{building.floors}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-3">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <span className="text-muted-foreground text-sm">Byggår</span>
              <span className="text-2xl font-bold">
                {building.construction.constructionYear}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <span className="text-muted-foreground text-sm">Hyresgäster</span>
              <span className="text-2xl font-bold">
                {building.tenants || 0}
              </span>
              <span className="text-xs text-muted-foreground">
                av {building.units} möjliga
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
