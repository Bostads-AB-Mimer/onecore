import { useState } from 'react'
import { PlayCircle, RotateCcw } from 'lucide-react'

import type {
  InspectionSubmitData,
  TenantInfoCardData,
} from '@/features/inspections/types/index'

import { components } from '@/services/api/core/generated/api-types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'

import {
  INSPECTION_TYPE_DIALOG_TITLE,
  type InspectionType,
} from '../constants/inspectionTypes'
import { initialRoomData } from '../lib/initialFormData'
import { InspectionForm } from './InspectionForm'
import { MobileInspectionSheet } from './mobile/MobileInspectionSheet'
type InspectionRoom = components['schemas']['InspectionRoom']
type Inspection = components['schemas']['InternalInspection']

import type { Room } from '@/services/types'

interface InspectionFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    inspectorName: string,
    rooms: Record<string, InspectionRoom>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => void
  rooms: Room[]
  buttonSize?: string
  tenant?: TenantInfoCardData
  address?: string
  apartmentCode?: string | null
  existingInspection: Inspection
  rentalId?: string
}

// Returns true if the room holds any user-entered data. The dialog uses this
// to decide whether to offer the "resume draft" choice; a false negative here
// causes the form to start fresh and silently overwrite the persisted draft
// on next save.
const roomHasAnyData = (room: InspectionRoom): boolean => {
  if (Object.values(room.conditions).some((c) => c && c.trim() !== '')) {
    return true
  }
  if (room.components && room.components.length > 0) return true
  if (room.detailComponents && room.detailComponents.length > 0) return true
  if (Object.values(room.componentNotes).some((n) => n && n.trim() !== '')) {
    return true
  }
  if (Object.values(room.componentPhotos).some((p) => p.length > 0)) return true
  if (Object.values(room.actions).some((a) => a.length > 0)) return true
  if (
    room.componentCosts &&
    Object.values(room.componentCosts).some((c) => (c ?? 0) > 0)
  ) {
    return true
  }
  if (
    room.componentCostResponsibilities &&
    Object.values(room.componentCostResponsibilities).some((r) => r != null)
  ) {
    return true
  }
  if (room.photos.length > 0) return true
  return false
}

const hasExistingData = (inspection?: Inspection): boolean => {
  if (!inspection?.rooms || inspection.rooms.length === 0) return false
  return inspection.rooms.some(roomHasAnyData)
}

export function InspectionFormDialog({
  isOpen,
  onClose,
  onSubmit,
  rooms,
  tenant,
  address,
  apartmentCode,
  existingInspection,
  rentalId,
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

  // Determine which inspection data to use based on user choice.
  // When starting fresh, wipe user-entered fields but rebuild the rooms list
  // from the *current* property-base rooms — so concurrent additions or
  // deletions in Xpand are reflected. Overlay `isAddedInThisInspection` from
  // the inspection's snapshot (sourced from the inspection_added_room join)
  // so the "Tillagt" badge survives the reset.
  const addedRoomIds = new Set(
    existingInspection?.rooms
      ?.filter((r) => r.isAddedInThisInspection)
      .map((r) => r.roomId) ?? []
  )
  const inspectionToUse =
    userChoice === 'fresh'
      ? {
          ...existingInspection,
          rooms: rooms.map((r) => ({
            ...initialRoomData,
            roomId: r.id,
            isAddedInThisInspection: addedRoomIds.has(r.id),
          })),
        }
      : existingInspection

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
        address={address}
        apartmentCode={apartmentCode}
        existingInspection={inspectionToUse}
        rentalId={rentalId}
      />
    )
  }

  const dialogTitle =
    INSPECTION_TYPE_DIALOG_TITLE[existingInspection.type as InspectionType] ??
    'Genomför besiktning'

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl p-4 sm:p-6 max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 space-y-1">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Gå igenom och bedöm skicket på alla rum
          </DialogDescription>
        </DialogHeader>

        <InspectionForm
          rooms={rooms}
          onSave={onSubmit}
          onCancel={onClose}
          tenant={tenant}
          address={address}
          apartmentCode={apartmentCode}
          existingInspection={inspectionToUse}
          rentalId={rentalId}
        />
      </DialogContent>
    </Dialog>
  )
}
