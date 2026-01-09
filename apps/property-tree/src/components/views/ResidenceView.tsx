import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Info, ClipboardList, Users, MessageSquare } from 'lucide-react'

import { Grid } from '@/components/ui/Grid'
import { residenceService, inspectionService } from '@/services/api/core'
import { WorkOrdersManagement } from '@/components/work-orders/WorkOrdersManagement'
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

export function ResidenceView() {
  const { residenceId } = useParams()

  const residenceQuery = useQuery({
    queryKey: ['residence', residenceId],
    queryFn: () => residenceService.getById(residenceId!),
    enabled: !!residenceId,
  })

  const residence = residenceQuery.data

  const inspectionsQuery = useQuery({
    queryKey: ['inspections', residence?.propertyObject.rentalId],
    queryFn: () =>
      inspectionService.getInspectionsForResidence(
        residence!.propertyObject.rentalId!
      ),
    enabled: !!residence?.propertyObject.rentalId,
  })

  const isLoading = residenceQuery.isLoading || inspectionsQuery.isLoading
  const error = residenceQuery.error || inspectionsQuery.error
  const inspections = inspectionsQuery.data ?? []
  const tenant: Tenant | null = null

  const { toast } = useToast()
  const handleInspectionCreated = () => {
    // setInspections(loadInspections()) // Relevant once we have real data
    console.log('Besiktning skapad')
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

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !residence) {
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
        <ResidenceBasicInfo residence={residence} />
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
                residenceId={residence.id}
                inspections={inspections}
                onInspectionCreated={handleInspectionCreated}
                tenant={tenant}
                residence={residence}
              />
            </TabLayout>
          </TabsContent>
          <TabsContent value="tenant">
            <Card>
              <CardContent className="p-4">
                <TenantInformation
                  rentalPropertyId={residence.propertyObject.rentalId!}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workorders">
            {residence.propertyObject.rentalId && (
              <WorkOrdersManagement
                contextType="residence"
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

export default ResidenceView
