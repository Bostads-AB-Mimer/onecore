import { useParams, useLocation } from 'react-router-dom'
import { usePropertyDetails, PropertyBasicInfo } from '@/features/properties'
import { PropertyTabs } from '@/widgets/property-tabs'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

const PropertyView = () => {
  const { propertyId } = useParams<{ propertyId: string }>()
  const { state } = useLocation()
  const companyId = state?.companyId

  const {
    data: propertyDetail,
    isLoading,
    error,
  } = usePropertyDetails(propertyId)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={propertyDetail}
        notFoundMessage="Fastigheten kunde inte hittas"
        searchedFor={propertyId}
      >
        {(propertyDetail) => (
          <>
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {propertyDetail.designation}
              </h1>
            </div>

            <PropertyBasicInfo
              propertyDetail={propertyDetail}
              showBasicInfoOnly={true}
            />

            <PropertyTabs propertyDetail={propertyDetail} />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}

export default PropertyView
