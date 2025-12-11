import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Users, MessageSquare } from 'lucide-react'

import { parkingSpaceService } from '@/services/api/core'
import { ParkingSpaceBasicInfo } from '../parking-space/ParkingSpaceBasicInfo'
import { TenantInformationByRentalId } from '../residence/TenantInformationByRentalId'
import { WorkOrdersManagement } from '../work-orders/WorkOrdersManagement'
import { ObjectPageLayout } from '../layout/ObjectPageLayout'
import { ObjectPageTabs } from '../layout/ObjectPageTabs'

export function ParkingSpaceView() {
  const { rentalId } = useParams()

  const parkingSpaceQuery = useQuery({
    queryKey: ['parkingSpace', rentalId],
    queryFn: () => parkingSpaceService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const parkingSpace = parkingSpaceQuery.data

  if (!parkingSpace) {
    return (
      <ObjectPageLayout
        isLoading={parkingSpaceQuery.isLoading}
        error={parkingSpaceQuery.error}
        data={parkingSpace}
        notFoundMessage="Parkering hittades inte"
        searchedFor={rentalId}
      >
        <></>
      </ObjectPageLayout>
    )
  }

  return (
    <ObjectPageLayout
      isLoading={parkingSpaceQuery.isLoading}
      error={parkingSpaceQuery.error}
      data={parkingSpace}
      notFoundMessage="Parkering hittades inte"
      searchedFor={rentalId}
    >
      <div className="lg:col-span-3 space-y-6">
        <ParkingSpaceBasicInfo parkingSpace={parkingSpace} />
      </div>

      <ObjectPageTabs
        defaultTab="tenant"
        tabs={[
          {
            value: 'tenant',
            label: 'Hyresgäst',
            icon: Users,
            content: (
              <TenantInformationByRentalId
                rentalPropertyId={parkingSpace.rentalId}
              />
            ),
          },
          {
            value: 'inspections',
            label: 'Besiktningar',
            icon: ClipboardList,
            disabled: true,
          },
          {
            value: 'workorders',
            label: 'Ärenden',
            icon: MessageSquare,
            content: (
              <WorkOrdersManagement
                contextType="residence"
                id={parkingSpace.rentalId}
              />
            ),
          },
        ]}
      />
    </ObjectPageLayout>
  )
}
