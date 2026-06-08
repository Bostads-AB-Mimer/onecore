import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/Dialog'

import { roomService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import { inspectionService } from '@/services/api/core/inspectionService'
import type { Room } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'

import { useTenantInfo } from '../hooks/useTenantInfo'
import { InspectionFormDialog } from './InspectionFormDialog'

type InternalInspection = components['schemas']['InternalInspection']
type ComponentWriteBackError = components['schemas']['ComponentWriteBackError']

interface InspectionConductDialogProps {
  inspectionId: string
  rentalId?: string
  rooms?: Room[]
  isOpen: boolean
  onClose: () => void
}

/**
 * Self-contained wrapper around InspectionFormDialog that:
 * - Fetches the internal inspection (with draft rooms) by id
 * - Resolves the rooms list (from prop or by fetching via residenceId)
 * - Persists submit as draft / completed via inspectionService
 *
 * Used from both the table ("Starta besiktning" / "Återuppta besiktning"
 * actions) and from the create flow once a new inspection has just been
 * created.
 */
export function InspectionConductDialog({
  inspectionId,
  rentalId,
  rooms,
  isOpen,
  onClose,
}: InspectionConductDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [componentWriteBackErrors, setComponentWriteBackErrors] = useState<
    ComponentWriteBackError[] | null
  >(null)
  const [writeBackErrorDialogOpen, setWriteBackErrorDialogOpen] =
    useState(false)

  const { data: internalInspection, isLoading: isLoadingInternal } =
    useQuery<InternalInspection>({
      queryKey: ['inspections-internal', inspectionId],
      queryFn: () => inspectionService.getInternalInspectionById(inspectionId),
      enabled: isOpen && !!inspectionId,
    })

  // If the caller didn't supply rooms, fall back to fetching them via the
  // inspection's residenceId (the Xpand rentalId).
  const needsRoomFetch = !rooms || rooms.length === 0
  const rentalIdForRooms = needsRoomFetch
    ? (rentalId ?? internalInspection?.residenceId)
    : undefined

  const { data: fetchedRooms, isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', rentalIdForRooms],
    queryFn: () => roomService.getByRentalId(rentalIdForRooms!),
    enabled: !!rentalIdForRooms,
  })

  const tenantInfo = useTenantInfo(
    internalInspection?.residenceId,
    internalInspection?.leaseId
  )

  const resolvedRooms = rooms && rooms.length > 0 ? rooms : (fetchedRooms ?? [])
  // Floorplan lookup uses the Xpand rentalId — prefer the explicit prop,
  // fall back to the inspection's residenceId.
  const resolvedRentalId = rentalId ?? internalInspection?.residenceId

  if (!isOpen || isLoadingInternal || isLoadingRooms || !internalInspection) {
    return null
  }

  return (
    <>
      <InspectionFormDialog
        isOpen={isOpen}
        onClose={onClose}
        rentalId={resolvedRentalId}
        onSubmit={async (
          inspectorName,
          inspectionRooms,
          status,
          additionalData
        ) => {
          try {
            await inspectionService.saveInspectionDraft(inspectionId, {
              inspectorName,
              rooms: Object.values(inspectionRooms),
              isFurnished: additionalData.isFurnished,
              isTenantPresent: additionalData.isTenantPresent,
              isNewTenantPresent: additionalData.isNewTenantPresent,
              checklist: additionalData.checklist,
              date: additionalData.date,
              type: additionalData.type,
            })

            // Component write-back happens inside the inspection-service when
            // the status transitions to "Genomförd". Errors come back in the
            // PATCH response envelope and are not persisted — re-fetching via
            // GET would lose them.
            let writeBackErrors: ComponentWriteBackError[] = []
            if (status === 'completed') {
              const result = await inspectionService.updateInspectionStatus(
                inspectionId,
                'Genomförd'
              )
              writeBackErrors = result.componentWriteBackErrors
            }

            await queryClient.invalidateQueries({ queryKey: ['inspections'] })
            await queryClient.invalidateQueries({
              queryKey: ['inspections-internal', inspectionId],
            })

            if (writeBackErrors.length > 0) {
              // Open the error dialog directly instead of a success toast +
              // action — toasts can auto-dismiss before the user notices.
              setComponentWriteBackErrors(writeBackErrors)
              setWriteBackErrorDialogOpen(true)
            } else {
              toast({
                title:
                  status === 'completed'
                    ? 'Besiktning slutförd'
                    : 'Utkast sparat',
                description:
                  status === 'completed'
                    ? 'Besiktningen har markerats som genomförd.'
                    : 'Besiktningen har sparats som utkast.',
              })
              onClose()
            }
          } catch {
            toast({
              title: 'Fel',
              description:
                status === 'completed'
                  ? 'Kunde inte slutföra besiktningen.'
                  : 'Kunde inte spara utkast.',
              variant: 'destructive',
            })
          }
        }}
        rooms={resolvedRooms}
        tenant={tenantInfo}
        address={internalInspection?.address}
        apartmentCode={internalInspection?.apartmentCode}
        existingInspection={internalInspection}
      />
      <Dialog
        open={writeBackErrorDialogOpen}
        onOpenChange={(open: boolean) => {
          setWriteBackErrorDialogOpen(open)
          // Closing the error dialog also dismisses the parent form so the
          // user doesn't have to dismiss it separately after reviewing.
          if (!open) onClose()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-1">
            <DialogTitle>Fel vid komponentuppdatering</DialogTitle>
            <DialogDescription>
              Följande komponenter kunde inte uppdateras:
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 space-y-2">
            {componentWriteBackErrors?.map((err) => (
              <li key={err.componentId} className="text-sm">
                <strong>{err.componentLabel}:</strong> {err.message}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
