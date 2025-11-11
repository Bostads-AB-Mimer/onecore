import { useParams } from 'react-router-dom'
import { LoadingState } from '@/components/residence/LoadingState'
import { ErrorState } from '@/components/residence/ErrorState'
import { useIsMobile } from '@/components/hooks/useMobile'
import { useResidenceDetail } from '@/components/hooks/useResidenceDetail'
import { ResidenceBasicInfo } from '@/components/residence/v2/ResidenceBasicInfo'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v2/Tabs'
import { TabsContent } from '@radix-ui/react-tabs'
import { ClipboardList, Info, MessageSquare, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/v2/Card'
import { RoomInfo } from '@/components/residence/RoomInfo'
import { TenantInformation } from '@/components/residence/TenantInformation'
import { WorkOrdersManagement } from '@/components/work-orders/WorkOrdersManagement'
import { Lease } from '@/services/api/core'
import { ResidenceFloorplan } from '@/components/residence/ResidenceFloorplan'

export const ResidenceView = () => {
  const { residenceId } = useParams()

  const {
    residence,
    residenceIsLoading,
    residenceError,
    building,
    leases,
    leasesIsLoading,
    leasesError,
  } = useResidenceDetail(residenceId!)

  const isMobile = useIsMobile()

  // Get current lease
  const currentLease: Lease | undefined = leases?.find(
    (l) => l.status === 'Current'
  ) as Lease

  const renderContent = () => {
    if (residenceIsLoading) {
      return (
        <div className="py-4">
          <LoadingState />
        </div>
      )
    }

    if (residenceError || !residence) {
      return (
        <div className="py-4">
          <ErrorState message={residenceError?.message} />
        </div>
      )
    }

    return (
      <div className="w-full space-y-6">
        <ResidenceBasicInfo
          residence={residence}
          building={building}
          lease={currentLease}
        />

        {/* TODO: Implement mobile Accordion for smaller screens */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="rooms" className="w-full">
            <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
              <TabsTrigger value="rooms" className="flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                Rumsinformation
              </TabsTrigger>
              <TabsTrigger
                value="floorplan"
                className="flex items-center gap-1.5"
              >
                Planritning
              </TabsTrigger>
              <TabsTrigger
                disabled
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
            <TabsContent value="floorplan">
              <ResidenceFloorplan
                rentalId={residence.propertyObject.rentalId ?? ''}
              />
            </TabsContent>
            <TabsContent value="inspections">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center text-sm text-muted-foreground">
                    Besiktningar kommer snart att finnas tillgängliga här.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tenant">
              <Card>
                <CardContent className="p-4">
                  <TenantInformation
                    isLoading={leasesIsLoading}
                    error={leasesError}
                    lease={currentLease}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="workorders">
              {residence?.propertyObject.rentalId && (
                <WorkOrdersManagement
                  contextType="residence"
                  id={residence?.propertyObject.rentalId}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  return renderContent()
}

export default ResidenceView
