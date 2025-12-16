import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Users, MessageSquare, FileText } from 'lucide-react'

import { parkingSpaceService, leaseService } from '@/services/api/core'
import { ParkingSpaceBasicInfo } from '../parking-space/ParkingSpaceBasicInfo'
import { CurrentTenant } from '../rental-object/CurrentTenant'
import {
  WorkOrdersManagement,
  ContextType,
} from '../work-orders/WorkOrdersManagement'
import { ObjectPageLayout } from '../layout/ObjectPageLayout'
import { ObjectPageTabs } from '../layout/ObjectPageTabs'
import { RentalObjectContracts } from '../rental-object/RentalObjectContracts'

export function ParkingSpaceView() {
  const { rentalId } = useParams()

  const parkingSpaceQuery = useQuery({
    queryKey: ['parkingSpace', rentalId],
    queryFn: () => parkingSpaceService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const parkingSpace = parkingSpaceQuery.data

  // Fetch lease data for rent info and to pass to CurrentTenant
  const leasesQuery = useQuery({
    queryKey: ['leases', parkingSpace?.rentalId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(parkingSpace!.rentalId!, {
        includeContacts: true,
      }),
    enabled: !!parkingSpace?.rentalId,
  })

  const currentLease = leasesQuery.data?.find(
    (lease) => lease.status === 'Current'
  )
  const currentRent = currentLease?.rentInfo?.currentRent?.currentRent

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
        <ParkingSpaceBasicInfo
          parkingSpace={parkingSpace}
          rent={currentRent}
          isLoadingRent={leasesQuery.isLoading}
        />
      </div>

      <ObjectPageTabs
        defaultTab="tenant"
        tabs={[
          {
            value: 'tenant',
            label: 'Hyresgäst',
            icon: Users,
            content: (
              <CurrentTenant
                rentalPropertyId={parkingSpace.rentalId}
                leases={leasesQuery.data}
                isLoading={leasesQuery.isLoading}
              />
            ),
          },
          {
            value: 'contracts',
            label: 'Kontrakt',
            icon: FileText,
            content: (
              <RentalObjectContracts rentalPropertyId={parkingSpace.rentalId} />
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
                contextType={ContextType.Residence}
                id={parkingSpace.rentalId}
              />
            ),
          },
        ]}
      />
    </ObjectPageLayout>
  )
}
