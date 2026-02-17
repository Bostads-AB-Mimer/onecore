import { useParams } from 'react-router-dom'

import { PropertyTabs } from '@/widgets/property-tabs'

import { PropertyBasicInfo, usePropertyDetails } from '@/features/properties'

import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

export function PropertyPage() {
  const { propertyCode } = useParams<{ propertyCode: string }>()

  const {
    data: propertyDetail,
    isLoading,
    error,
  } = usePropertyDetails(propertyCode)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={propertyDetail}
        notFoundMessage="Fastigheten kunde inte hittas"
        searchedFor={propertyCode}
      >
        {(propertyDetail) => (
          <>
            <h1 className="text-3xl font-bold mb-2">
              {propertyDetail.designation}
            </h1>

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
