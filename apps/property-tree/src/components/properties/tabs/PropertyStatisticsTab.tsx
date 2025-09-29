import { PropertyStatisticsSummary } from '@/components/properties/PropertyStatisticsSummary'
import { TabLayout } from '@/components/ui/TabLayout'
import { BarChart3 } from 'lucide-react'
//import type { PropertyDetail } from '@/types/api'

interface PropertyStatisticsTabProps {
  property: any //PropertyDetail
}

export const PropertyStatisticsTab = ({
  property,
}: PropertyStatisticsTabProps) => {
  return (
    <TabLayout title="Fastighetssammanställning" showCard={true}>
      <PropertyStatisticsSummary property={property} />
    </TabLayout>
  )
}
