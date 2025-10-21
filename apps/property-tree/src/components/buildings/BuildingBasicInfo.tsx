import { Property, Building } from '@/services/types'
import { CollapsibleInfoCard } from '@/components/ui/CollapsibleInfoCard'

interface BuildingBasicInfoProps {
  building: Building
  property: Property
  address?: string
  objectNumber?: string
}

export const BuildingBasicInfo = ({
  building,
  property,
  address,
}: BuildingBasicInfoProps) => {
  const { quantityValues } = building

  // Extract specific quantity values
  // TODO: Figure out which value is "allmän yta" in xpand

  /*
  const buildingArea =
    (quantityValues?.find((x) => x.id === 'AREATEMP')?.value || '-') + ' m²'
  */

  const buildingArea = '-'

  const residenceCount =
    quantityValues?.find((x) => x.id === 'ANTALLGH')?.value ?? 0

  const facilitiesCount =
    quantityValues?.find((x) => x.id === 'ANTALLOK')?.value ?? 0

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
        <p className="font-medium">{buildingArea}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Antal lägenheter</p>
        <p className="font-medium">{residenceCount}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Antal lokaler</p>
        <p className="font-medium">{facilitiesCount}</p>
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
