import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/v2/Dialog'
import { useIsMobile } from '@/components/hooks/useMobile'
import { MobileInspectionSheet } from './mobile/MobileInspectionSheet'
import { DesktopInspectionForm } from './desktop/DesktopInspectionForm'

import { components } from '@/services/api/core/generated/api-types'
type Tenant = NonNullable<components['schemas']['Lease']['tenants']>[number]
import type { Room } from '@/services/types'
import type { InspectionRoom as InspectionRoomType } from '@/components/residence/inspection/types'

interface InspectionFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    inspectorName: string,
    rooms: Record<string, InspectionRoomType>
  ) => void
  rooms: Room[]
  buttonSize?: string
  tenant?: any // Optional tenant prop if we want to pass different tenant data
}

export function InspectionFormDialog({
  isOpen,
  onClose,
  onSubmit,
  rooms,
  buttonSize,
  tenant,
}: InspectionFormDialogProps) {
  const isMobile = useIsMobile()

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  // Use mobile sheet for mobile devices
  if (isMobile) {
    return (
      <MobileInspectionSheet
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={onSubmit}
        rooms={rooms}
        tenant={tenant}
      />
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl p-4 sm:p-6 max-h-[95vh] overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle>Genomför besiktning</DialogTitle>
          <DialogDescription>
            Gå igenom och bedöm skicket på alla rum
          </DialogDescription>
        </DialogHeader>

        <DesktopInspectionForm
          rooms={rooms}
          onSave={onSubmit}
          onCancel={onClose}
          tenant={tenant}
        />
      </DialogContent>
    </Dialog>
  )
}
