import type { PropertyDetail } from '@/types/api'
import { CardContent } from '@/components/ui/v2/Card'
import { PropertyMap } from './PropertyMap'

interface PropertyMapViewProps {
  propertyDetail: PropertyDetail
}

export const PropertyMapView = ({ propertyDetail }: PropertyMapViewProps) => {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Ritningen visar fastighetens byggnader och placering. Hovra över
        byggnaderna för detaljer.
      </p>

      {/*
      {propertyDetail.propertyMap && (
        <PropertyMap
          propertyMap={propertyDetail.propertyMap}
          buildings={propertyDetail.buildings}
        />
      )}
        */}
    </>
  )
}
