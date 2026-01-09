import { format } from 'date-fns'
import { Badge } from '@/components/ui/v3/Badge'
import { Button } from '@/components/ui/v2/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import type { Inspection } from './types'

interface InspectionTableProps {
  inspections: Inspection[]
  onInspectionClick: (inspection: Inspection) => void
  showAddress?: boolean
  showRoomCount?: boolean
}

// Helper to check if inspection is internal (has rooms)
const isInternalInspection = (
  inspection: Inspection
): inspection is Inspection & { _tag: 'internal' } => {
  return inspection._tag === 'internal'
}

export function InspectionTable({
  inspections,
  onInspectionClick,
  showAddress = false,
  showRoomCount = true,
}: InspectionTableProps) {
  // Check which columns have data
  const hasTypeData = inspections.some(
    (i) => !isInternalInspection(i) && i.type
  )
  const hasLeaseIdData = inspections.some(
    (i) => !isInternalInspection(i) && i.leaseId
  )
  const hasAddressData =
    showAddress &&
    inspections.some((i) => !isInternalInspection(i) && i.address)
  const hasRoomData =
    showRoomCount && inspections.some((i) => isInternalInspection(i))

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Tilldelad</TableHead>
            {hasTypeData && <TableHead>Typ</TableHead>}
            {hasLeaseIdData && <TableHead>Kontrakt ID</TableHead>}
            {hasAddressData && <TableHead>Adress</TableHead>}
            <TableHead>Planerat datum/tid</TableHead>
            <TableHead>Besiktningsnummer</TableHead>
            {hasRoomData && <TableHead>Antal rum</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Åtgärder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspections.map((inspection) => {
            const isInternal = isInternalInspection(inspection)
            return (
              <TableRow key={inspection.id} className="group">
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span>
                      {isInternal
                        ? inspection.inspectedBy
                        : inspection.inspector}
                    </span>
                    {isInternal && inspection.status === 'draft' && (
                      <Badge variant="secondary" className="w-fit">
                        Utkast
                      </Badge>
                    )}
                  </div>
                </TableCell>
                {hasTypeData && (
                  <TableCell>
                    {!isInternal ? inspection.type || 'N/A' : '-'}
                  </TableCell>
                )}
                {hasLeaseIdData && (
                  <TableCell>
                    {!isInternal ? inspection.leaseId || 'N/A' : '-'}
                  </TableCell>
                )}
                {hasAddressData && (
                  <TableCell>
                    {!isInternal ? inspection.address || 'N/A' : '-'}
                  </TableCell>
                )}
                <TableCell>
                  {format(new Date(inspection.date), 'yyyy-MM-dd')}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {isInternal ? inspection.inspectionNumber : inspection.id}
                </TableCell>
                {hasRoomData && (
                  <TableCell>
                    {isInternal ? Object.keys(inspection.rooms).length : '-'}
                  </TableCell>
                )}
                <TableCell>
                  <Badge
                    variant={
                      isInternal
                        ? inspection.status === 'completed' ||
                          inspection.isCompleted
                          ? 'default'
                          : 'secondary'
                        : inspection.status === 'Genomförd'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {isInternal
                      ? inspection.status === 'completed' ||
                        inspection.isCompleted ||
                        Object.values(inspection.rooms).every(
                          (room) => room.isHandled
                        )
                        ? 'Slutförd'
                        : inspection.status === 'draft'
                          ? 'Utkast'
                          : 'Pågående'
                      : inspection.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onInspectionClick(inspection)}
                  >
                    Visa detaljer
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
