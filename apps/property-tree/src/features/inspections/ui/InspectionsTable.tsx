import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { components } from '@/services/api/core/generated/api-types'
import { inspectionService } from '@/services/api/core/inspectionService'

import { useToast } from '@/shared/hooks/useToast'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

import {
  canStart,
  getCompletedInspectionColumns,
  getOngoingInspectionColumns,
  INSPECTION_STATUS,
  type InspectionTableColumn,
  renderInspectionMobileCard,
} from '../constants'
import { useInspectors } from '../hooks/useInspectors'
import { useUpdateInspectionStatus } from '../hooks/useUpdateInspectionStatus'
import { useUpdateInspector } from '../hooks/useUpdateInspector'
import { InspectionFormDialog } from './InspectionFormDialog'
import { InspectionProtocol } from './InspectionProtocol'

type Inspection = components['schemas']['InspectionWithSource']
type DetailedInspection = components['schemas']['DetailedInspection']

interface InspectionsTableProps {
  inspections: Inspection[]
  rentalId?: string
  isCompleted?: boolean
  hiddenColumns?: string[]
  columns?: InspectionTableColumn[]
  emptyMessage?: string
}

export function InspectionsTable({
  inspections,
  rentalId,
  isCompleted = false,
  hiddenColumns = [],
  columns,
  emptyMessage,
}: InspectionsTableProps) {
  const { data: inspectors } = useInspectors()
  const { toast } = useToast()
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false)
  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false)
  const [selectedInspectionId, setSelectedInspectionId] = useState<
    string | null
  >(null)

  const { mutate: updateInspector } = useUpdateInspector({
    onSuccess: () => {
      toast({
        title: 'Besiktningsman uppdaterad',
        description: 'Tilldelad besiktningsman har ändrats.',
      })
    },
    onError: () => {
      toast({
        title: 'Fel',
        description: 'Kunde inte uppdatera besiktningsman.',
        variant: 'destructive',
      })
    },
  })

  const { startInspection, isPending } = useUpdateInspectionStatus({
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

  const handleUpdateInspector = (inspectionId: string, inspector: string) => {
    updateInspector({ inspectionId, inspector })
  }

  // Fetch detailed inspection when selected
  const { data: detailedInspection } = useQuery<DetailedInspection>({
    queryKey: ['inspections', selectedInspectionId],
    queryFn: () =>
      inspectionService.getInspectionById(selectedInspectionId as string),
    enabled: !!selectedInspectionId,
  })

  const handleInspectionClick = (inspection: Inspection) => {
    if (isPending) return

    setSelectedInspectionId(inspection.id)

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
  const tableColumns =
    columns ||
    (isCompleted
      ? getCompletedInspectionColumns(handleInspectionClick)
      : getOngoingInspectionColumns(handleInspectionClick, {
          inspectors: inspectors,
          onUpdateInspector: handleUpdateInspector,
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
        mobileCardRenderer={renderInspectionMobileCard(handleInspectionClick)}
      />

      {isResumeDialogOpen && (
        <InspectionFormDialog
          isOpen={isResumeDialogOpen}
          onClose={() => setIsResumeDialogOpen(false)}
          onSubmit={() => {}}
          rooms={[]}
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
