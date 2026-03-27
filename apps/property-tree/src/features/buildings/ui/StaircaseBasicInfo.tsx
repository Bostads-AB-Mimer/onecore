import { Building, Staircase } from '@/services/types'

import { toTitleCase } from '@/shared/lib/textUtils'
import { CollapsibleInfoCard } from '@/shared/ui/CollapsibleInfoCard'

interface StaircaseBasicInfoProps {
  staircase: Staircase
  building: Building
  residenceCount: number
}

export const StaircaseBasicInfo = ({
  staircase,
  building,
  residenceCount,
}: StaircaseBasicInfoProps) => {
  const previewContent = (
    <div className="space-y-2">
      <div>
        <span className="text-sm text-muted-foreground">Fastighet: </span>
        <span className="font-medium">
          {staircase.property?.propertyName
            ? toTitleCase(staircase.property.propertyName)
            : '-'}
        </span>
      </div>
      <div>
        <span className="text-sm text-muted-foreground">Byggnad: </span>
        <span className="font-medium">{building.code}</span>
      </div>
    </div>
  )

  const allInfoContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Fastighet</p>
        <p className="font-medium">
          {staircase.property?.propertyName && staircase.property?.propertyCode
            ? `${toTitleCase(staircase.property.propertyName)}, ${staircase.property.propertyCode}`
            : '-'}
        </p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Byggnad</p>
        <p className="font-medium">
          {building.name
            ? `${toTitleCase(building.name)}, ${building.code}`
            : building.code}
        </p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Antal bostäder</p>
        <p className="font-medium">{residenceCount}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Hiss</p>
        <p className="font-medium">
          {staircase.features?.accessibleByElevator ? 'Ja' : 'Nej'}
        </p>
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
