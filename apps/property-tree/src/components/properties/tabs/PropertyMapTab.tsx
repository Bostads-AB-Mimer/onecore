import { PropertyMapView } from '@/components/properties/PropertyMapView'
import { TabLayout } from '@/components/ui/TabLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Map } from 'lucide-react'
import type { PropertyDetail } from '@/types/api'

interface PropertyMapTabProps {
  propertyDetail: PropertyDetail
}

export const PropertyMapTab = ({ propertyDetail }: PropertyMapTabProps) => {
  return (
    <TabLayout title="Ritningar" showCard={true}>
      {/*
      {propertyDetail.propertyMap ? (
        <PropertyMapView propertyDetail={propertyDetail} />
      ) : (
       */}
      <EmptyState
        icon={Map}
        title="Ritningar saknas"
        description="Ritningar finns inte tillgängliga för denna fastighet."
      />
      {/*}
      )}
      */}
    </TabLayout>
  )
}
