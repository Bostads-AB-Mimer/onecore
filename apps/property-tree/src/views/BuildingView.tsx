import { useLocation, useParams } from 'react-router-dom'
import { useBuildingDetails, BuildingBasicInfo } from '@/features/buildings'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { BuildingTabs } from '@/widgets/building-tabs'

const BuildingDetailPage = () => {
  const { buildingId } = useParams()
  const { state } = useLocation()
  const propertyId = state?.propertyId

  const { data, isLoading, error } = useBuildingDetails(propertyId, buildingId)

  const basePath = `/residences`

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={data}
        notFoundMessage="Byggnaden kunde inte hittas"
        searchedFor={buildingId}
      >
        {(data) => (
          <>
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
              property={data.property}
              address={data.building.name ?? '-'}
            />
            <BuildingTabs
              building={data.building}
              staircases={data.staircases}
              basePath={basePath}
            />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}

export default BuildingDetailPage
