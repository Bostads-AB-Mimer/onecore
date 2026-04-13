import type { InspectionSubmitData } from '@/features/inspections/types/index'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Sheet, SheetContent } from '@/shared/ui/Sheet'

import type { TenantInfoCardData } from '../TenantInfoCard'
import { MobileInspectionForm } from './MobileInspectionForm'
type Inspection = components['schemas']['InternalInspection']
type InspectionRoom = components['schemas']['InspectionRoom']

interface MobileInspectionSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    inspectorName: string,
    rooms: Record<string, InspectionRoom>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => void
  rooms: Room[]
  tenant?: TenantInfoCardData
  address?: string
  apartmentCode?: string | null
  existingInspection?: Inspection
}

export function MobileInspectionSheet({
  isOpen,
  onClose,
  onSubmit,
  rooms,
  tenant,
  address,
  apartmentCode,
  existingInspection,
}: MobileInspectionSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[95vh] p-0 max-w-none w-full">
        <MobileInspectionForm
          rooms={rooms}
          onSave={onSubmit}
          onCancel={onClose}
          tenant={tenant}
          address={address}
          apartmentCode={apartmentCode}
          existingInspection={existingInspection}
        />
      </SheetContent>
    </Sheet>
  )
}
