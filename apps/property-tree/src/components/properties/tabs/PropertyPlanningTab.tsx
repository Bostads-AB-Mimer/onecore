import { TabLayout } from '@/components/ui/TabLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Calendar } from 'lucide-react'

export const PropertyPlanningTab = () => {
  return (
    <TabLayout title="Planerat underhåll">
      <EmptyState
        icon={Calendar}
        title="Ingen planering tillgänglig"
        description="Det finns ingen planeringsinformation registrerad för denna fastighet."
      />
    </TabLayout>
  )
}
