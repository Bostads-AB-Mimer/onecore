import type { TenantInfoCardData } from '@/features/inspections/types/index'

import { cn } from '@/shared/lib/utils'

import { InspectionDetailsCard } from './InspectionDetailsCard'
import { TenantInfoCard } from './TenantInfoCard'

interface InspectionInfoSectionProps {
  inspectorName: string
  setInspectorName: (name: string) => void
  tenant?: TenantInfoCardData
  address?: string
  apartmentCode?: string | null
  layout?: 'vertical' | 'horizontal'
}

/**
 * Composes the two info cards that sit at the top of the inspection form:
 * a tenant summary and the inspection details (inspector select, etc).
 *
 * Layout defaults to vertical (stacked); pass `layout="horizontal"` to
 * render them side-by-side on large screens.
 */
export function InspectionInfoSection({
  inspectorName,
  setInspectorName,
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
      />
    </div>
  )
}
