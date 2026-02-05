import { PropertyStatisticsSummary } from '@/features/properties/components/PropertyStatisticsSummary'
import { TabLayout } from '@/components/ui/TabLayout'
import { PropertyDetail } from '@/types/api'

interface PropertyStatisticsTabProps {
  property: PropertyDetail
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
