import { Sheet, SheetContent } from '@/components/ui/Sheet'
import { MobileInspectionForm } from './MobileInspectionForm'
import type { Room } from '@/services/types'
import type {
  InspectionRoom as InspectionRoomType,
  InspectionSubmitData,
  InternalInspection,
} from '@/components/inspections/types'

interface MobileInspectionSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    inspectorName: string,
    rooms: Record<string, InspectionRoomType>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => void
  rooms: Room[]
  tenant?: any
  existingInspection?: InternalInspection
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
