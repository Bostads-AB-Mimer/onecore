import type { TenantInfoCardData } from '@/features/inspections/types/index'

import { cn } from '@/shared/lib/utils'

import type { InspectionType } from '../constants/inspectionTypes'
import { InspectionDetailsCard } from './InspectionDetailsCard'
import { TenantInfoCard } from './TenantInfoCard'

interface InspectionInfoSectionProps {
  inspectorName: string
  setInspectorName: (name: string) => void
  inspectionTime: string
  setInspectionTime: (time: string) => void
  inspectionType: InspectionType
  setInspectionType: (type: InspectionType) => void
  tenant?: TenantInfoCardData
  address?: string
  apartmentCode?: string | null
  layout?: 'vertical' | 'horizontal'
}

/**
 * Composes the two info cards that sit at the top of the inspection form:
 * a tenant summary and the inspection details (inspector, Klockslag, type).
 *
 * Layout defaults to vertical (stacked); pass `layout="horizontal"` to
 * render them side-by-side on large screens.
 */
export function InspectionInfoSection({
  inspectorName,
  setInspectorName,
  inspectionTime,
  setInspectionTime,
  inspectionType,
  setInspectionType,
  tenant,
  address,
  apartmentCode,
  layout = 'vertical',
}: InspectionInfoSectionProps) {
  const isHorizontal = layout === 'horizontal'

  return (
    <div
      className={cn(
        isHorizontal ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'
      )}
    >
      {tenant && (
        <TenantInfoCard
          tenant={tenant}
          address={address}
          apartmentCode={apartmentCode}
        />
      )}
      <InspectionDetailsCard
        inspectorName={inspectorName}
        setInspectorName={setInspectorName}
        inspectionTime={inspectionTime}
        setInspectionTime={setInspectionTime}
        inspectionType={inspectionType}
        setInspectionType={setInspectionType}
      />
    </div>
  )
}
