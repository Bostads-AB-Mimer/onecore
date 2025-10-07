import { Building } from '@/services/types'

interface BuildingHeaderProps {
  building: Building
  propertyName?: string
}

export const BuildingHeader = ({
  building,
  propertyName,
}: BuildingHeaderProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">
            {building.name}
          </h1>
        </div>
      </div>
    </div>
  )
}
