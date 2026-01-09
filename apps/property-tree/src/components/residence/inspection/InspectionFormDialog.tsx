import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/v2/Button'
import { PlayCircle, RotateCcw } from 'lucide-react'
import { useIsMobile } from '@/components/hooks/useMobile'
import { MobileInspectionSheet } from './mobile/MobileInspectionSheet'
import { DesktopInspectionForm } from './desktop/DesktopInspectionForm'

import { components } from '@/services/api/core/generated/api-types'
type Tenant = NonNullable<components['schemas']['Lease']['tenants']>[number]
import type { Room } from '@/services/types'
import type {
  InspectionRoom as InspectionRoomType,
  InspectionSubmitData,
  InternalInspection,
} from '@/components/inspections/types'

interface InspectionFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    inspectorName: string,
    rooms: Record<string, InspectionRoomType>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => void
  rooms: Room[]
  buttonSize?: string
  tenant?: any
  existingInspection?: InternalInspection
}

// Check if inspection has actual saved data
const hasExistingData = (inspection?: InternalInspection): boolean => {
  if (!inspection?.rooms) return false
  return (
    Object.keys(inspection.rooms).length > 0 &&
    Object.values(inspection.rooms).some((room) =>
      Object.values(room.conditions).some((c) => c && c.trim() !== '')
    )
  )
}

export function InspectionFormDialog({
  isOpen,
  onClose,
  onSubmit,
  rooms,
  buttonSize,
  tenant,
  existingInspection,
}: InspectionFormDialogProps) {
  const isMobile = useIsMobile()
  const hasSavedData = hasExistingData(existingInspection)

  // State to track if user has chosen to continue or start fresh
  const [userChoice, setUserChoice] = useState<'continue' | 'fresh' | null>(
    hasSavedData ? null : 'fresh' // If no saved data, go directly to form
  )

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setUserChoice(hasSavedData ? null : 'fresh') // Reset choice on close
      onClose()
    }
  }

  // Determine which inspection data to use based on user choice
  const inspectionToUse =
    userChoice === 'fresh' ? undefined : existingInspection

  // Show choice dialog if there's saved data and user hasn't chosen yet
  if (hasSavedData && userChoice === null) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-1">
            <DialogTitle>Påbörjad besiktning</DialogTitle>
            <DialogDescription>
              Det finns sparad data för denna besiktning. Vill du fortsätta där
              du slutade eller börja om från början?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => setUserChoice('continue')}
              className="justify-start h-auto py-4"
            >
              <PlayCircle className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Fortsätt där du slutade</div>
                <div className="text-sm text-primary-foreground/70 font-normal">
                  Ladda sparad data och fortsätt besiktningen
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => setUserChoice('fresh')}
              className="justify-start h-auto py-4"
            >
              <RotateCcw className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Börja om från början</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Rensa all sparad data och starta om
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (isMobile) {
    return (
      <MobileInspectionSheet
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={onSubmit}
        rooms={rooms}
        tenant={tenant}
        existingInspection={inspectionToUse}
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
          existingInspection={inspectionToUse}
        />
      </DialogContent>
    </Dialog>
  )
}
