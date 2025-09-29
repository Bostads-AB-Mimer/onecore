import { PropertyDetail } from '@/types/api'

interface PropertyStatisticsSummaryProps {
  property: PropertyDetail
}

export const PropertyStatisticsSummary = ({
  property,
}: PropertyStatisticsSummaryProps) => {
  return (
    <div className="rounded-md border">
      <div className="grid grid-cols-3 border-b bg-muted/50 px-4 py-2">
        <div className="font-medium">Mängdtyp</div>
        <div className="font-medium text-right">Mängd</div>
        <div className="font-medium text-right">Enhet</div>
      </div>

      <div className="divide-y">
        {property.propertyValues?.map(
          ({
            name,
            value,
            unitId,
          }: {
            name: string
            value: number
            unitId: string
          }) => {
            const convertUnitId = (unitId: string) => {
              if (unitId == 'm2') return 'm²'
              if (unitId == 'pcs') return 'st'
              return unitId
            }

            return (
              <div
                key={name}
                className="grid grid-cols-3 px-4 py-2 hover:bg-muted/30 transition-colors"
              >
                <div>{name}</div>
                <div className="text-right">{value}</div>
                <div className="text-right">{convertUnitId(unitId)}</div>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}
