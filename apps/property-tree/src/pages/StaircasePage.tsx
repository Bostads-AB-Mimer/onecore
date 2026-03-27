import { useParams } from 'react-router-dom'

import { StaircaseTabs } from '@/widgets/staircase-tabs'

import { StaircaseBasicInfo, useStaircaseDetails } from '@/features/buildings'

import { toTitleCase } from '@/shared/lib/textUtils'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

export function StaircasePage() {
  const { staircaseCode, buildingCode } = useParams()
  const { building, staircase, residences, isLoading, error } =
    useStaircaseDetails(buildingCode, staircaseCode)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={staircase}
        notFoundMessage="Uppgång hittades inte"
        searchedFor={staircaseCode}
      >
        {(staircase) => (
          <>
            <h1 className="text-3xl font-bold">
              {toTitleCase(staircase.name ?? staircase.code)}
            </h1>

            <StaircaseBasicInfo
              staircase={staircase}
              building={building!}
              residenceCount={residences?.length ?? 0}
            />

            <StaircaseTabs
              staircase={staircase}
              building={building!}
              residences={residences ?? []}
            />
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
