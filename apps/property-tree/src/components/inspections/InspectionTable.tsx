import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import { Eye } from 'lucide-react'
import { components } from '@/services/api/core/generated/api-types'
import { useState } from 'react'
import { InspectionReadOnly } from '../residence/inspection/InspectionReadOnly'
import { InspectionFormDialog } from '../residence/inspection/InspectionFormDialog'

type Inspection = components['schemas']['Inspection']

export type InspectionTableColumn =
  | 'inspector'
  | 'type'
  | 'leaseId'
  | 'address'
  | 'phone'
  | 'masterKey'
  | 'terminationDate'
  | 'date'
  | 'id'
  | 'status'
  | 'actions'

interface InspectionTableProps {
  inspections: Inspection[]
  onInspectionClick: (inspection: Inspection) => void
  isCompleted?: boolean
  hiddenColumns?: InspectionTableColumn[]
}

export function InspectionTable({
  inspections,
  onInspectionClick,
  isCompleted = false,
  hiddenColumns = [],
}: InspectionTableProps) {
  const isColumnVisible = (column: InspectionTableColumn) =>
    !hiddenColumns.includes(column)

  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false)

  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false)

  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null)

  const handleInspectionClick = (inspection: Inspection) => {
    setSelectedInspection(inspection)
    if (inspection.status === 'Genomförd') {
      setIsProtocolDialogOpen(true)
    } else {
      setIsResumeDialogOpen(true)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {isColumnVisible('inspector') && <TableHead>Tilldelad</TableHead>}
            {isColumnVisible('type') && <TableHead>Prioritet</TableHead>}
            {isColumnVisible('leaseId') && <TableHead>Kontrakt ID</TableHead>}
            {isColumnVisible('address') && <TableHead>Adress</TableHead>}
            {isColumnVisible('phone') && <TableHead>Telefonnummer</TableHead>}
            {isColumnVisible('masterKey') && <TableHead>Huvudnyckel</TableHead>}
            {isColumnVisible('terminationDate') && (
              <TableHead>Uppsägning</TableHead>
            )}
            {isColumnVisible('date') && (
              <TableHead>
                {isCompleted ? 'Utfört' : 'Planerat datum/tid'}
              </TableHead>
            )}
            {isColumnVisible('id') && <TableHead>Besiktningsnummer</TableHead>}
            {isColumnVisible('status') && <TableHead>Status</TableHead>}
            {isColumnVisible('actions') && (
              <TableHead className="text-right">Åtgärder</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspections.map((inspection) => {
            return (
              <TableRow key={inspection.id} className="group">
                {isColumnVisible('inspector') && (
                  <TableCell>{inspection.inspector || 'N/A'}</TableCell>
                )}
                {isColumnVisible('type') && (
                  <TableCell>{inspection.type || 'inflytt'}</TableCell>
                )}
                {isColumnVisible('leaseId') && (
                  <TableCell>{inspection.leaseId || 'N/A'}</TableCell>
                )}
                {isColumnVisible('address') && (
                  <TableCell>{inspection.address || 'N/A'}</TableCell>
                )}
                {isColumnVisible('phone') && (
                  <TableCell>
                    {inspection.lease?.tenants?.[0]?.phoneNumbers?.find(
                      (number) => number.isMainNumber
                    )?.phoneNumber || 'N/A'}
                  </TableCell>
                )}
                {isColumnVisible('masterKey') && (
                  <TableCell>
                    {inspection.masterKeyAccess
                      ? inspection.masterKeyAccess === 'Huvudnyckel'
                        ? 'Ja'
                        : 'Nej'
                      : 'Okänt'}
                  </TableCell>
                )}
                {isColumnVisible('terminationDate') && (
                  <TableCell>
                    <span className="whitespace-nowrap">
                      {inspection.lease?.lastDebitDate
                        ? new Date(
                            inspection.lease.lastDebitDate
                          ).toLocaleDateString('sv-SE')
                        : 'N/A'}
                    </span>
                  </TableCell>
                )}
                {isColumnVisible('date') && (
                  <TableCell>
                    <span className="whitespace-nowrap">
                      {inspection.date
                        ? new Date(inspection.date).toLocaleDateString('sv-SE')
                        : 'N/A'}
                    </span>
                  </TableCell>
                )}
                {isColumnVisible('id') && (
                  <TableCell className="font-mono text-sm">
                    {inspection.id || 'N/A'}
                  </TableCell>
                )}
                {isColumnVisible('status') && (
                  <TableCell>
                    <Badge
                      variant={
                        inspection.status === 'Genomförd'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {inspection.status || 'Okänd'}
                    </Badge>
                  </TableCell>
                )}
                {isColumnVisible('actions') && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInspectionClick(inspection)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {inspection.status
                        ? inspection.status === 'Genomförd'
                          ? 'Visa detaljer'
                          : inspection.status === 'Registrerad'
                            ? 'Starta besiktning'
                            : inspection.status === 'Påbörjad'
                              ? 'Återuppta besiktning'
                              : 'Visa detaljer'
                        : 'Visa detaljer'}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {isResumeDialogOpen && (
        <InspectionFormDialog
          isOpen={isResumeDialogOpen}
          onClose={() => setIsResumeDialogOpen(false)}
          onSubmit={() => {}}
          rooms={[]}
        />
      )}

      {isProtocolDialogOpen && (
        <InspectionReadOnly
          inspection={selectedInspection}
          isOpen={isProtocolDialogOpen}
          onClose={() => setIsProtocolDialogOpen(false)}
        />
      )}
    </div>
  )
}
