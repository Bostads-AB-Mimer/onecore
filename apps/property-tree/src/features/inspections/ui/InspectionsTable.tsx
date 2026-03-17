import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { residenceService, roomService } from '@/services/api/core'
import { components } from '@/services/api/core/generated/api-types'
import { inspectionService } from '@/services/api/core/inspectionService'
import type { Room } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

import {
  canStart,
  getCompletedInspectionColumns,
  getOngoingInspectionColumns,
  INSPECTION_STATUS,
  type InspectionTableColumn,
  isCompleted as isCompletedStatus,
  isXpandSource,
  renderInspectionMobileCard,
} from '../constants'
import { useInspectors } from '../hooks/useInspectors'
import { useUpdateInspectionStatus } from '../hooks/useUpdateInspectionStatus'
import { useUpdateInspector } from '../hooks/useUpdateInspector'
import { InspectionFormDialog } from './InspectionFormDialog'
import { InspectionProtocol } from './InspectionProtocol'

type Inspection = components['schemas']['InspectionWithSource']
type DetailedInspection = components['schemas']['DetailedInspection']
type InternalInspection = components['schemas']['InternalInspection']

interface InspectionsTableProps {
  inspections: Inspection[]
  rentalId?: string
  isCompleted?: boolean
  hiddenColumns?: string[]
  columns?: InspectionTableColumn[]
  emptyMessage?: string
  rooms?: Room[]
}

export function InspectionsTable({
  inspections,
  rentalId,
  isCompleted = false,
  hiddenColumns = [],
  columns,
  emptyMessage,
  rooms = [],
}: InspectionsTableProps) {
  const { data: inspectors } = useInspectors()
  const { toast } = useToast()
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false)
  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false)
  const [selectedInspectionId, setSelectedInspectionId] = useState<
    string | null
  >(null)
  const [selectedInspectionSource, setSelectedInspectionSource] = useState<
    'xpand' | 'internal' | null
  >(null)

  const queryClient = useQueryClient()
  const { startInspection, isPending, pendingInspectionId } =
    useUpdateInspectionStatus({
      rentalId,
      onSuccess: () => {
        toast({
          title: 'Status uppdaterad',
          description: 'Besiktningsstatus har uppdaterats.',
        })
      },
      onError: () => {
        toast({
          title: 'Fel',
          description: 'Kunde inte uppdatera besiktningsstatus.',
          variant: 'destructive',
        })
      },
    })

  const { mutate: updateInspector } = useUpdateInspector()

  // Fetch detailed inspection when selected
  const { data: detailedInspection } = useQuery<DetailedInspection>({
    queryKey: ['inspections', selectedInspectionId],
    queryFn: () =>
      inspectionService.getInspectionById(selectedInspectionId as string),
    enabled: !!selectedInspectionId && selectedInspectionSource === 'xpand',
  })

  // Fetch internal inspection (with draft rooms) when form is open
  const { data: internalInspection, isLoading: isLoadingInternal } =
    useQuery<InternalInspection>({
      queryKey: ['inspections-internal', selectedInspectionId],
      queryFn: () =>
        inspectionService.getInternalInspectionById(
          selectedInspectionId as string
        ),
      enabled: !!selectedInspectionId && isResumeDialogOpen,
    })

  // internalInspection.residenceId stores the Xpand rentalId, not the property service UUID.
  // We first resolve the residence UUID via the rentalId, then fetch rooms by UUID.
  const rentalIdForRooms =
    rooms.length === 0 ? internalInspection?.residenceId : undefined

  const { data: residenceForRooms, isLoading: isLoadingResidence } = useQuery({
    queryKey: ['residence', rentalIdForRooms],
    queryFn: () => residenceService.getByRentalId(rentalIdForRooms!),
    enabled: !!rentalIdForRooms,
  })

  const { data: fetchedRooms, isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', residenceForRooms?.id],
    queryFn: () => roomService.getByResidenceId(residenceForRooms!.id),
    enabled: !!residenceForRooms?.id,
  })

  const resolvedRooms = rooms.length > 0 ? rooms : (fetchedRooms ?? [])

  const handleInspectionClick = (inspection: Inspection) => {
    if (isPending) return

    // Xpand inspections that aren't completed must be handled in Xpand
    if (
      isXpandSource(inspection.source) &&
      !isCompletedStatus(inspection.status)
    ) {
      return
    }

    setSelectedInspectionId(inspection.id)
    setSelectedInspectionSource(inspection.source)

    if (inspection.status === INSPECTION_STATUS.COMPLETED) {
      setIsProtocolDialogOpen(true)
      setIsResumeDialogOpen(false)
    } else {
      if (canStart(inspection.status)) {
        startInspection(inspection.id)
      }
      setIsResumeDialogOpen(true)
      setIsProtocolDialogOpen(false)
    }
  }

  // Determine which columns to use
  const loading = { isPending, pendingInspectionId }
  const tableColumns =
    columns ||
    (isCompleted
      ? getCompletedInspectionColumns(handleInspectionClick, loading)
      : getOngoingInspectionColumns(handleInspectionClick, loading, {
          inspectors: inspectors ?? [],
          onUpdateInspector: (inspectionId, inspector) =>
            updateInspector({ inspectionId, inspector }),
        }))

  // Filter columns if hiddenColumns is used
  const filteredColumns =
    hiddenColumns.length > 0
      ? tableColumns.filter((col) => !hiddenColumns.includes(col.key as any))
      : tableColumns

  return (
    <>
      <ResponsiveTable
        data={inspections}
        columns={filteredColumns}
        keyExtractor={(inspection: Inspection) => inspection.id}
        emptyMessage={emptyMessage || 'Inga besiktningar i denna kategori'}
        mobileCardRenderer={renderInspectionMobileCard(
          handleInspectionClick,
          loading
        )}
      />

      {isResumeDialogOpen &&
        !isLoadingInternal &&
        !isLoadingResidence &&
        !isLoadingRooms && (
          <InspectionFormDialog
            isOpen={isResumeDialogOpen}
            onClose={() => setIsResumeDialogOpen(false)}
            onSubmit={async (inspectorName, inspectionRooms, status) => {
              try {
                await inspectionService.saveInspectionDraft(
                  selectedInspectionId as string,
                  {
                    inspectorName,
                    rooms: Object.values(inspectionRooms),
                  }
                )

                if (status === 'completed') {
                  await inspectionService.updateInspectionStatus(
                    selectedInspectionId as string,
                    'Genomförd'
                  )
                }

                await queryClient.invalidateQueries({
                  queryKey: ['inspections'],
                })
                await queryClient.invalidateQueries({
                  queryKey: ['inspections-internal', selectedInspectionId],
                })
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
                setIsResumeDialogOpen(false)
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
            existingInspection={internalInspection}
          />
        )}

      {isProtocolDialogOpen && (
        <InspectionProtocol
          inspection={detailedInspection ?? null}
          isOpen={isProtocolDialogOpen}
          onClose={() => setIsProtocolDialogOpen(false)}
        />
      )}
    </>
  )
}
