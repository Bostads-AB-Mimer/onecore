import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ClipboardList,
  Users,
  MessageSquare,
  FileText,
  Wrench,
  Info,
} from 'lucide-react'

import { facilityService, leaseService } from '@/services/api/core'
import { FacilityBasicInfo } from '../facility/FacilityBasicInfo'
import { FacilityComponents } from '../facility/FacilityComponents'
import { CurrentTenant } from '../rental-object/CurrentTenant'
import { WorkOrdersManagement } from '../work-orders/WorkOrdersManagement'
import { ObjectPageLayout } from '../layout/ObjectPageLayout'
import { ObjectPageTabs } from '../layout/ObjectPageTabs'
import { RentalObjectContracts } from '../rental-object/RentalObjectContracts'
import { RoomInfo } from '../residence/RoomInfo'

import { ContextType } from '@/types/ui'

export function FacilityView() {
  const { rentalId } = useParams()

  const facilityQuery = useQuery({
    queryKey: ['facility', rentalId],
    queryFn: () => facilityService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const facility = facilityQuery.data

  // Fetch lease data for rent info and to pass to CurrentTenant
  const leasesQuery = useQuery({
    queryKey: ['leases', facility?.rentalInformation?.rentalId],
    queryFn: () =>
      leaseService.getByRentalPropertyId(
        facility!.rentalInformation!.rentalId!,
        { includeContacts: true, includeRentInfo: true }
      ),
    enabled: !!facility?.rentalInformation?.rentalId,
  })

  const currentLease = leasesQuery.data?.find(
    (lease) => lease.status === 'Current'
  )
  const currentRent = currentLease?.rentInfo?.currentRent?.currentRent

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
        <FacilityBasicInfo
          facility={facility}
          rent={currentRent}
          isRented={!!currentLease}
          isLoadingLease={leasesQuery.isLoading}
        />
      </div>

      <ObjectPageTabs
        defaultTab="components"
        tabs={[
          {
            value: 'components',
            label: 'Komponenter',
            icon: Wrench,
            content: (
              <FacilityComponents
                propertyObjectId={facility.propertyObjectId}
                facilityName={facility.name || facility.code}
              />
            ),
          },
          {
            value: 'rooms',
            label: 'Rumsinformation',
            icon: Info,
            content: <RoomInfo facilityId={facility.id} />,
          },
          {
            value: 'tenant',
            label: 'Hyresgäst',
            icon: Users,
            content: (
              <CurrentTenant
                rentalPropertyId={facility.rentalInformation?.rentalId!}
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
              <RentalObjectContracts
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
                contextType={ContextType.Residence}
                id={facility.rentalInformation?.rentalId!}
              />
            ),
          },
        ]}
      />
    </ObjectPageLayout>
  )
}
