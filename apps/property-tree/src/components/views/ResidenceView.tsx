import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Info, ClipboardList, Users, MessageSquare } from 'lucide-react'

import { Grid } from '@/components/ui/Grid'
import { useResidenceDetail } from '../hooks/useResidenceDetail'
import { residenceService } from '@/services/api/core'
import {
  ContextType,
  WorkOrdersManagement,
} from '@/components/work-orders/WorkOrdersManagement'
import { ResidenceBasicInfo } from '@/components/residence/ResidenceBasicInfo'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import { Card, CardContent } from '@/components/ui/v2/Card'
import { RoomInfo } from '@/components/residence/RoomInfo'
import { TenantInformation } from '@/components/residence/TenantInformation'
import { TabLayout } from '@/components/ui/TabLayout'
import { InspectionsList } from '@/components/residence/inspection/InspectionsList'
import { components } from '@/services/api/core/generated/api-types'
type Tenant = NonNullable<components['schemas']['Lease']['tenants']>[number]
import { useToast } from '@/components/hooks/useToast'
import type { Room } from '@/services/types'
import type { Inspection } from '@/components/residence/inspection/types'

export function ResidenceView() {
  const { residenceId } = useParams()

  const {
    residence,
    residenceIsLoading,
    residenceError,
    building,
    buildingIsLoading,
    buildingError,
    leases,
    leasesIsLoading,
    leasesError,
  } = useResidenceDetail(residenceId!)

  const currentRent =
    leases && leases.length > 0
      ? leases[0]?.rentInfo?.currentRent?.currentRent
      : null

  // Mock/placeholder data for InspectionsList
  const mockRoomsData: Room[] = [
    {
      id: '1',
      code: 'RUM-101',
      name: 'Vardagsrum',
      // size: 22.5, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 1,
      },
      features: {
        hasToilet: false,
        isHeated: true,
        hasThermostatValve: true,
        orientation: 1,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 1,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '1',
        code: 'VARDAGSRUM',
        name: 'Vardagsrum',
        use: 1,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: '2',
      code: 'RUM-102',
      name: 'Kök',
      // size: 12.0, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 2,
      },
      features: {
        hasToilet: false,
        isHeated: true,
        hasThermostatValve: true,
        orientation: 2,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 2,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '2',
        code: 'KOK',
        name: 'Kök',
        use: 2,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: '3',
      code: 'RUM-103',
      name: 'Sovrum 1',
      // size: 15.8, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 1,
      },
      features: {
        hasToilet: false,
        isHeated: true,
        hasThermostatValve: true,
        orientation: 3,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 3,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '3',
        code: 'SOVRUM',
        name: 'Sovrum',
        use: 1,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: '4',
      code: 'RUM-104',
      name: 'Badrum',
      // size: 6.2, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 3,
      },
      features: {
        hasToilet: true,
        isHeated: true,
        hasThermostatValve: true,
        orientation: 2,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 4,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '4',
        code: 'BADRUM',
        name: 'Badrum',
        use: 3,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: '5',
      code: 'RUM-105',
      name: 'Sovrum 2',
      // size: 13.5, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 1,
      },
      features: {
        hasToilet: false,
        isHeated: true,
        hasThermostatValve: true,
        orientation: 4,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 5,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '3',
        code: 'SOVRUM',
        name: 'Sovrum',
        use: 1,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: '6',
      code: 'RUM-106',
      name: 'Hall',
      // size: 8.3, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 4,
      },
      features: {
        hasToilet: false,
        isHeated: true,
        hasThermostatValve: false,
        orientation: 1,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 6,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '5',
        code: 'HALL',
        name: 'Hall',
        use: 4,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: '7',
      code: 'RUM-107',
      name: 'Uteplats',
      // size: 25.0, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 5,
      },
      features: {
        hasToilet: false,
        isHeated: false,
        hasThermostatValve: false,
        orientation: 2,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 7,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '6',
        code: 'UTEPLATS',
        name: 'Uteplats',
        use: 5,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: '8',
      code: 'RUM-108',
      name: 'Balkong',
      // size: 8.0, Property does not exist in Room schema
      usage: {
        shared: false,
        allowPeriodicWorks: true,
        spaceType: 5,
      },
      features: {
        hasToilet: false,
        isHeated: false,
        hasThermostatValve: false,
        orientation: 1,
      },
      dates: {
        installation: null,
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        availableFrom: null,
        availableTo: null,
      },
      sortingOrder: 8,
      deleted: false,
      timestamp: '2024-01-01T00:00:00Z',
      roomType: {
        id: '7',
        code: 'BALKONG',
        name: 'Balkong',
        use: 5,
        optionAllowed: 0,
        isSystemStandard: 1,
        allowSmallRoomsInValuation: 0,
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
  ]
  const inspections: Inspection[] = []
  const tenant: Tenant | null = null

  const { toast } = useToast()
  const handleInspectionCreated = () => {
    // setInspections(loadInspections())
    console.log('Besiktning skapad')
    // TODO toast below won't be functional until layout changes from kundkort epic
    // have been merged in. This will happen later.
    toast({
      description: `Besiktningen har skapats`,
    })
  }

  // Debug: Log residence data when it changes
  useEffect(() => {
    if (residence) {
      console.log('🏠 ResidenceView - Residence data loaded:', residence)
      console.log(
        '🏠 ResidenceView - Residence JSON:',
        JSON.stringify(residence, null, 2)
      )
    }
  }, [residence])

  if (residenceIsLoading) {
    return <LoadingSkeleton />
  }

  if (residenceError || !residence) {
    return (
      <div className="py-4 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Bostad hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="py-4 animate-in grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-3 space-y-6">
        <ResidenceBasicInfo
          residence={residence}
          building={building}
          rent={currentRent}
        />
      </div>

      <div className="lg:col-span-3 space-y-6">
        <Tabs defaultValue="rooms" className="w-full">
          <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
            <TabsTrigger value="rooms" className="flex items-center gap-1.5">
              <Info className="h-4 w-4" />
              Rumsinformation
            </TabsTrigger>
            <TabsTrigger
              value="inspections"
              className="flex items-center gap-1.5"
            >
              <ClipboardList className="h-4 w-4" />
              Besiktningar
            </TabsTrigger>
            <TabsTrigger value="tenant" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Hyresgäst
            </TabsTrigger>
            <TabsTrigger
              value="workorders"
              className="flex items-center gap-1.5"
            >
              <MessageSquare className="h-4 w-4" />
              Ärenden
            </TabsTrigger>
          </TabsList>
          <TabsContent value="rooms">
            <Card>
              <CardContent className="p-4">
                <RoomInfo residenceId={residence.id} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="inspections">
            <TabLayout title="Besiktningar" count={0} showCard={true}>
              <InspectionsList
                rooms={mockRoomsData}
                inspections={inspections}
                onInspectionCreated={handleInspectionCreated}
                tenant={tenant}
              />
            </TabLayout>
          </TabsContent>
          <TabsContent value="tenant">
            <Card>
              <CardContent className="p-4">
                <TenantInformation
                  isLoading={leasesIsLoading}
                  error={leasesError}
                  lease={leases[0]}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workorders">
            {residence?.propertyObject.rentalId && (
              <WorkOrdersManagement
                contextType={ContextType.Residence}
                id={residence.propertyObject.rentalId}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="py-4 animate-in">
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      <Grid cols={4} className="mb-8">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
          />
        ))}
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
