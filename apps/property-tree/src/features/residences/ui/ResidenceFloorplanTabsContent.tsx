import { FloorplanImage } from '@/shared/ui/FloorplanImage'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

export const ResidenceFloorplanTabsContent = ({
  rentalId,
}: {
  rentalId: string
}) => {
  return (
    <TabLayout title="Bofaktablad">
      <div className="text-center">
        <FloorplanImage rentalId={rentalId} />
      </div>
    </TabLayout>
  )
}
