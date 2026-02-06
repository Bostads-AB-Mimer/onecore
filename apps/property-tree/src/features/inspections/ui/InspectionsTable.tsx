import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { components } from '@/services/api/core/generated/api-types'
import { inspectionService } from '@/services/api/core/inspectionService'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'
import { InspectionProtocol } from './InspectionProtocol'
import { InspectionFormDialog } from './InspectionFormDialog'
import {
  getOngoingInspectionColumns,
  getCompletedInspectionColumns,
  renderInspectionMobileCard,
  type InspectionTableColumn,
} from '../constants'
import { INSPECTION_STATUS } from '../constants'

type Inspection = components['schemas']['Inspection']
type DetailedInspection = components['schemas']['DetailedInspection']

interface InspectionsTableProps {
  inspections: Inspection[]
  isCompleted?: boolean
  hiddenColumns?: string[]
  columns?: InspectionTableColumn[]
  emptyMessage?: string
}

export function InspectionsTable({
  inspections,
  isCompleted = false,
  hiddenColumns = [],
  columns,
  emptyMessage,
}: InspectionsTableProps) {
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false)
  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false)
  const [selectedInspectionId, setSelectedInspectionId] = useState<
    string | null
  >(null)

  // Fetch detailed inspection when selected
  const { data: detailedInspection } = useQuery<DetailedInspection>({
    queryKey: ['inspections', selectedInspectionId],
    queryFn: () =>
      inspectionService.getInspectionById(selectedInspectionId as string),
    enabled: !!selectedInspectionId,
  })

  const handleInspectionClick = (inspection: Inspection) => {
    setSelectedInspectionId(inspection.id)

    if (inspection.status === INSPECTION_STATUS.COMPLETED) {
      setIsProtocolDialogOpen(true)
      setIsResumeDialogOpen(false)
    } else {
      setIsResumeDialogOpen(true)
      setIsProtocolDialogOpen(false)
    }
  }

  // Determine which columns to use
  const tableColumns =
    columns ||
    (isCompleted
      ? getCompletedInspectionColumns(handleInspectionClick)
      : getOngoingInspectionColumns(handleInspectionClick))

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
