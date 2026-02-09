import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useBuildingDetail } from '@/features/buildings'
//import { useToast } from '@/hooks/use-toast'
import { BuildingBasicInfo } from '@/features/buildings'
import { BuildingTabs } from '@/widgets/building-tabs'
import { PropertyBreadcrumb } from '@/components/navigation/Breadcrumb'

const BuildingDetailPage = () => {
  const { buildingId } = useParams()
  const { state } = useLocation()
  const propertyId = state?.propertyId
  const companyId = state?.companyId

  //const { toast } = useToast()

  // Use property directly as the key
  //const propertyKey = property

  // Fetch building data
  const { data, isLoading, error } = useBuildingDetail(propertyId, buildingId)

  // Base path for apartment links
  const basePath = `/residences`

  useEffect(() => {
    if (error) {
      /*
        toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda byggnadsdata. Kontrollera URL:en.',
        variant: 'destructive',
      })
        */
    }
  }, [error /*toast*/])

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-6 py-4">
          <div className="h-8 bg-secondary rounded w-64"></div>
          <div className="h-4 bg-secondary rounded w-32 mt-2"></div>
          <div className="h-[200px] bg-secondary rounded mt-6"></div>
        </div>
      )
    }

    if (isLoading || !data) {
      return (
        <div className="text-center py-10 space-y-4">
          <h2 className="text-2xl font-bold">Byggnaden kunde inte hittas</h2>
          <p className="text-muted-foreground">
            Kontrollera adressen och försök igen
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Sökte efter: {buildingId} i {propertyId}
          </p>
        </div>
      )
    }

    return (
      <div className="py-4 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Hide for now */}
        {/*
        <PropertyBreadcrumb
          property={{
            id: data.property?.id,
            name: data.property?.designation,
          }}
          building={{
            id: data.building?.id,
            name: data.building?.name ?? 'byggnad',
          }}
          companyId={companyId}
        />
        */}
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">
                {data.building.name}
              </h1>
            </div>
          </div>
        </div>
        <BuildingBasicInfo
          building={data.building}
          property={data?.property}
          address={data?.building?.name ?? '-'}
        />
        <BuildingTabs
          building={data.building}
          staircases={data?.staircases}
          basePath={basePath}
        />
      </div>
    )
  }

  return renderContent()
}

export default BuildingDetailPage
