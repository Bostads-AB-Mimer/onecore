import { useLocation, useParams } from 'react-router-dom'

import { BuildingTabs } from '@/widgets/building-tabs'

import { BuildingBasicInfo, useBuildingDetails } from '@/features/buildings'

import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

const BuildingPage = () => {
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
            <h1 className="text-3xl font-bold">{data.building.name}</h1>
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

export default BuildingPage
