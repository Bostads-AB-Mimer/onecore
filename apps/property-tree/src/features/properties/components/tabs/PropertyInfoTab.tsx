import { PropertyBasicInfo } from '@/features/properties/components/PropertyBasicInfo'
import { TabLayout } from '@/components/ui/TabLayout'
import { Info } from 'lucide-react'
import type { PropertyDetail } from '@/types/api'

interface PropertyInfoTabProps {
  property: PropertyDetail
}

export const PropertyInfoTab = ({ property }: PropertyInfoTabProps) => {
  return (
    <TabLayout title="Fastighetsinfo" showCard={true}>
      <PropertyBasicInfo propertyDetail={property} showBasicInfoOnly={false} />
    </TabLayout>
  )
}
