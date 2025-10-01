import { Building, Property, PropertyDetail } from '@/types/api'
import { CollapsibleInfoCard } from '@/components/ui/CollapsibleInfoCard'

interface BuildingBasicInfoProps {
  building: Building
  property: PropertyDetail
  residenceCount?: number
  address?: string
  objectNumber?: string
}

export const BuildingBasicInfo = ({
  building,
  property,
  address,
  residenceCount,
  objectNumber,
}: BuildingBasicInfoProps) => {
  // Calculate total number of spaces/premises (lokaler)
  const totalSpaces = building.spaces?.length || 0

  // Preview content for mobile
  const previewContent = (
    <div className="space-y-2">
      <div>
        <span className="text-sm text-muted-foreground">Objektsnummer: </span>
        <span className="font-medium">{building.code}</span>
      </div>
      <div>
        <span className="text-sm text-muted-foreground">Fastighet: </span>
        <span className="font-medium">
          {property?.designation || 'Okänd fastighet'}
        </span>
      </div>
    </div>
  )

  // All building information fields
  const allInfoContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {/* Grupp 1 - Identifiering */}
      <div>
        <p className="text-sm text-muted-foreground">Objektsnummer</p>
        <p className="font-medium">{building.code}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Fastighet</p>
        <p className="font-medium">
          {property?.designation || 'Okänd fastighet'}
        </p>
      </div>

      {address && (
        <div>
          <p className="text-sm text-muted-foreground">Adress</p>
          <p className="font-medium">{address}</p>
        </div>
      )}

      {/* Grupp 2 - Byggnadsegenskaper */}
      <div>
        <p className="text-sm text-muted-foreground">Byggnadstyp</p>
        <p className="font-medium">{building.buildingType.name}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Byggnadsår</p>
        <p className="font-medium">
          {building.construction.constructionYear || 'Ej angivet'}
        </p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Ombyggnadsår</p>
        <p className="font-medium">
          {building.construction.renovationYear || '-'}
        </p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Allmän yta</p>
        <p className="font-medium">{building.area} m²</p>
      </div>

      {/* Grupp 3 - Innehåll/Kapacitet */}
      <div>
        <p className="text-sm text-muted-foreground">Antal lägenheter</p>
        <p className="font-medium">{residenceCount}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Antal lokaler</p>
        <p className="font-medium">{totalSpaces}</p>
      </div>
    </div>
  )

  return (
    <CollapsibleInfoCard
      title="Grundläggande information"
      previewContent={previewContent}
    >
      {allInfoContent}
    </CollapsibleInfoCard>
  )
}
