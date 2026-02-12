import { Sheet, SheetContent } from '@/shared/ui/Sheet'
import { MobileInspectionForm } from './MobileInspectionForm'
import type { Room } from '@/services/types'
import type { InspectionSubmitData } from '@/features/inspections/types/index'
import type { components } from '@/services/api/core/generated/api-types'
type Inspection = components['schemas']['Inspection']
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
  tenant?: any
  existingInspection?: Inspection
}

export function MobileInspectionSheet({
  isOpen,
  onClose,
  onSubmit,
  rooms,
  tenant,
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
          existingInspection={existingInspection}
        />
      </SheetContent>
    </Sheet>
  )
}
