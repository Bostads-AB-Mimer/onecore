import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Users, MessageSquare } from 'lucide-react'

import { facilityService } from '@/services/api/core'
import { FacilityBasicInfo } from '../facility/FacilityBasicInfo'
import { TenantInformation } from '../residence/TenantInformation'
import { WorkOrdersManagement } from '../work-orders/WorkOrdersManagement'
import { ObjectPageLayout } from '../layout/ObjectPageLayout'
import { ObjectPageTabs } from '../layout/ObjectPageTabs'

export function FacilityView() {
  const { rentalId } = useParams()

  const facilityQuery = useQuery({
    queryKey: ['facility', rentalId],
    queryFn: () => facilityService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const facility = facilityQuery.data

  if (!facility) {
    return (
      <ObjectPageLayout
        isLoading={facilityQuery.isLoading}
        error={facilityQuery.error}
        data={facility}
        notFoundMessage="Lokal hittades inte"
        searchedFor={rentalId}
      >
        <></>
      </ObjectPageLayout>
    )
  }

  return (
    <ObjectPageLayout
      isLoading={facilityQuery.isLoading}
      error={facilityQuery.error}
      data={facility}
      notFoundMessage="Lokal hittades inte"
      searchedFor={rentalId}
    >
      <div className="lg:col-span-3 space-y-6">
        <FacilityBasicInfo facility={facility} />
      </div>

      <ObjectPageTabs
        defaultTab="tenant"
        tabs={[
          {
            value: 'tenant',
            label: 'Hyresgäst',
            icon: Users,
            content: (
              <TenantInformation
                rentalPropertyId={facility.rentalInformation?.rentalId!}
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
                id={facility.rentalInformation?.rentalId!}
              />
            ),
          },
        ]}
      />
    </ObjectPageLayout>
  )
}
