import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Info, ClipboardList, Users, MessageSquare } from 'lucide-react'

import { Grid } from '@/components/ui/Grid'
import { residenceService } from '@/services/api'
import { ResidenceWorkOrders } from '../shared/ResidenceWorkOrders'
import { ResidenceBasicInfo } from '../residence/ResidenceBasicInfo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/v2/Tabs'
import { Card, CardContent } from '../ui/v2/Card'
import { RoomInfo } from '../residence/RoomInfo'

export function ResidenceView() {
  const { residenceId } = useParams()

  const residenceQuery = useQuery({
    queryKey: ['residence', residenceId],
    queryFn: () => residenceService.getById(residenceId!),
    enabled: !!residenceId,
  })

  const isLoading = residenceQuery.isLoading
  const error = residenceQuery.error
  const residence = residenceQuery.data

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !residence) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Bostad hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in grid grid-cols-1 lg:grid-cols-3 gap-8">
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
              disabled
              value="inspections"
              className="flex items-center gap-1.5"
            >
              <ClipboardList className="h-4 w-4" />
              Besiktningar
            </TabsTrigger>
            <TabsTrigger
              disabled
              value="tenant"
              className="flex items-center gap-1.5"
            >
              <Users className="h-4 w-4" />
              Hyresgäst
            </TabsTrigger>
            <TabsTrigger
              disabled
              value="issues"
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
        </Tabs>
      </div>
      <div className="lg:col-span-2 space-y-6">
        {residence.propertyObject.rentalId && (
          <ResidenceWorkOrders rentalId={residence.propertyObject.rentalId} />
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-in">
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
