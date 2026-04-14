import { useQuery, useQueryClient } from '@tanstack/react-query'

import { roomService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import { inspectionService } from '@/services/api/core/inspectionService'
import type { Room } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'

import { useTenantInfo } from '../hooks/useTenantInfo'
import { InspectionFormDialog } from './InspectionFormDialog'

type InternalInspection = components['schemas']['InternalInspection']

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

  if (!isOpen || isLoadingInternal || isLoadingRooms) {
    return null
  }

  return (
    <InspectionFormDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={async (inspectorName, inspectionRooms, status) => {
        try {
          await inspectionService.saveInspectionDraft(inspectionId, {
            inspectorName,
            rooms: Object.values(inspectionRooms),
          })

          if (status === 'completed') {
            await inspectionService.updateInspectionStatus(
              inspectionId,
              'Genomförd'
            )
          }

          await queryClient.invalidateQueries({ queryKey: ['inspections'] })
          await queryClient.invalidateQueries({
            queryKey: ['inspections-internal', inspectionId],
          })

          toast({
            title:
              status === 'completed' ? 'Besiktning slutförd' : 'Utkast sparat',
            description:
              status === 'completed'
                ? 'Besiktningen har markerats som genomförd.'
                : 'Besiktningen har sparats som utkast.',
          })
          onClose()
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
  )
}
