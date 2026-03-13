import {
  ClipboardList,
  FileText,
  Info,
  MessageSquare,
  Users,
  Wrench,
} from 'lucide-react'

import { SpaceComponents } from '@/features/component-library'
import { LeasesTabContent } from '@/features/leases'
import { CurrentTenant } from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/leaseService'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import { FacilityTabsMobile } from './FacilityTabsMobile'
import { RoomsTabContent } from './RoomsTabContent'

type Facility = components['schemas']['FacilityDetails']

interface FacilityTabsProps {
  facility: Facility
  leases?: Lease[]
  leasesIsLoading: boolean
}

export function FacilityTabs({
  facility,
  leases,
  leasesIsLoading,
}: FacilityTabsProps) {
  const isMobile = useIsMobile()
  const rentalId = facility.rentalInformation?.rentalId

  if (isMobile) {
    return (
      <FacilityTabsMobile
        facility={facility}
        leases={leases}
        leasesIsLoading={leasesIsLoading}
      />
    )
  }

  return (
    <Tabs defaultValue="components" className="w-full">
      <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
        <TabsTrigger value="components" className="flex items-center gap-1.5">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Komponenter</span>
        </TabsTrigger>
        <TabsTrigger value="rooms" className="flex items-center gap-1.5">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">Rumsinformation</span>
        </TabsTrigger>
        <TabsTrigger value="tenant" className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Hyresgäst</span>
        </TabsTrigger>
        <TabsTrigger value="leases" className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Kontrakt</span>
        </TabsTrigger>
        <TabsTrigger
          value="inspections"
          className="flex items-center gap-1.5"
          disabled
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Besiktningar</span>
        </TabsTrigger>
        <TabsTrigger value="work-orders" className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Ärenden</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="components">
        <SpaceComponents
          spaceId={facility.propertyObjectId}
          spaceName={facility.name || facility.code}
        />
      </TabsContent>

      <TabsContent value="rooms">
        <RoomsTabContent facilityId={facility.id} />
      </TabsContent>

      <TabsContent value="tenant">
        {rentalId && (
          <CurrentTenant
            rentalPropertyId={rentalId}
            leases={leases}
            isLoading={leasesIsLoading}
          />
        )}
      </TabsContent>

      <TabsContent value="leases">
        {rentalId && <LeasesTabContent rentalPropertyId={rentalId} />}
      </TabsContent>

      <TabsContent value="work-orders">
        {rentalId && (
          <WorkOrdersTabContent
            contextType={ContextType.Residence}
            id={rentalId}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
