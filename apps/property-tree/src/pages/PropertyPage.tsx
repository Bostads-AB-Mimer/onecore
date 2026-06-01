import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download } from 'lucide-react'

import { PropertyTabs } from '@/widgets/property-tabs'

import {
  PropertyBasicInfo,
  usePropertyDetails,
  usePropertyKeysExport,
} from '@/features/properties'

import { Button } from '@/shared/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'

const ALL_BUILDINGS = '__all__'

export function PropertyPage() {
  const { propertyCode } = useParams<{ propertyCode: string }>()

  const {
    data: propertyDetail,
    isLoading,
    error,
  } = usePropertyDetails(propertyCode)

  const [selectedBuilding, setSelectedBuilding] =
    useState<string>(ALL_BUILDINGS)
  const exportMutation = usePropertyKeysExport()

  const handleExport = () => {
    if (!propertyDetail?.designation) return
    exportMutation.mutate({
      propertyName: propertyDetail.designation,
      buildingCode:
        selectedBuilding === ALL_BUILDINGS ? undefined : selectedBuilding,
    })
  }

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
            <div className="flex flex-row flex-wrap items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold">
                {propertyDetail.designation}
              </h1>
              <div className="flex flex-row items-center gap-2">
                <Select
                  value={selectedBuilding}
                  onValueChange={setSelectedBuilding}
                  disabled={(propertyDetail.buildings ?? []).length === 0}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Alla byggnader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_BUILDINGS}>
                      Alla byggnader
                    </SelectItem>
                    {(propertyDetail.buildings ?? []).map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name || b.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportMutation.isPending
                    ? 'Exporterar...'
                    : 'Exportera nycklar'}
                </Button>
              </div>
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
