import type { BuildingLocation, Building } from '@/shared/types/api'
import { Map } from 'lucide-react'

interface PropertyMapProps {
  propertyMap: {
    image: string
    buildings: BuildingLocation[]
  }
  buildings: Building[]
}

export const PropertyMap = ({ propertyMap, buildings }: PropertyMapProps) => {
  return (
    <div className="relative w-full h-[400px] border border-border rounded-md overflow-hidden bg-white">
      <div className="absolute inset-0 bg-gray-100 p-4">
        {/* Bakgrundsbild för fastighetens tomt */}
        <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
          <Map className="h-32 w-32 text-gray-400" />
        </div>

        {/* Rita ut byggnaderna */}
        {propertyMap.buildings.map((building) => {
          // Hitta byggnadsinformation för tooltip
          const buildingInfo = buildings.find((b) => b.id === building.id)

          return (
            <div
              key={building.id}
              className="absolute bg-primary/80 backdrop-blur-sm border border-primary text-white p-2 rounded text-xs font-medium cursor-help"
              style={{
                top: `${building.y}px`,
                left: `${building.x}px`,
                width: `${building.width}px`,
                height: `${building.height}px`,
              }}
              title={
                buildingInfo
                  ? `${buildingInfo.name} (${buildingInfo.type}, ${buildingInfo.area} m²)`
                  : building.name
              }
            >
              {building.name}
            </div>
          )
        })}
      </div>
    </div>
  )
}
