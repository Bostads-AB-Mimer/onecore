import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { InspectionFormDialog } from '@/components/residence/inspection/InspectionFormDialog'
import { InspectionReadOnly } from '@/components/residence/inspection/InspectionReadOnly'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import { roomService } from '@/services/api/core'
import { Grid } from '@/components/ui/Grid'

import type { Room, ResidenceDetails } from '@/services/types'
import { Badge } from '@/components/ui/v3/Badge'
import { format } from 'date-fns'
import type {
  Inspection,
  InspectionRoom as InspectionRoomType,
  InspectionSubmitData,
  ResidenceInfo,
  TenantSnapshot,
} from '@/components/residence/inspection/types'
import { useToast } from '@/components/hooks/useToast'

interface InspectionsListProps {
  residenceId: string
  inspections: Inspection[]
  onInspectionCreated: () => void
  tenant?: any
  residence?: ResidenceDetails
}

// Generera besiktningsnummer
// TODO: is this something the frontend should do? This is copied from Lovable.
const generateInspectionNumber = (): string => {
  const year = new Date().getFullYear()
  const randomNum = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')
  return `B-${year}-${randomNum}`
}

// Skapa ResidenceInfo från Residence
const createResidenceInfo = (residence?: ResidenceDetails): ResidenceInfo => {
  if (!residence) {
    return {
      id: '',
      objectNumber: '',
      address: 'Okänd adress',
      apartmentType: null,
      size: null,
    }
  }
  return {
    id: residence.id,
    objectNumber: residence.code,
    address: residence.name ?? '',
    apartmentType:
      residence.propertyObject.rentalInformation?.type.code ?? null,
    size: residence.size,
  }
}

export function InspectionsList({
  residenceId,
  inspections,
  onInspectionCreated,
  tenant,
  residence,
}: InspectionsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const { toast } = useToast()

  const roomsQuery = useQuery({
    queryKey: ['rooms', residenceId],
    queryFn: () => roomService.getByResidenceId(residenceId),
  })

  if (roomsQuery.isLoading) {
    return <LoadingSkeleton />
  }

  if (roomsQuery.error || !roomsQuery.data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Rum hittades inte
        </h2>
      </div>
    )
  }

  const rooms = roomsQuery.data ?? []

  const activeInspection = inspections.find(
    (inspection) =>
      !inspection.isCompleted &&
      Object.keys(inspection.rooms).length > 0 &&
      !Object.values(inspection.rooms).every((room) => room.isHandled)
  )

  const completedInspections = inspections.filter(
    (inspection) => inspection !== activeInspection
  )

  const handleOpenInspection = (inspection: Inspection) => {
    setSelectedInspection(inspection)
    setIsViewDialogOpen(true)
  }

  const handleSubmit = (
    inspectorName: string,
    roomsData: Record<string, InspectionRoomType>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => {
    const newInspection: Inspection = {
      id: `inspection-${Date.now()}`,
      inspectionNumber: generateInspectionNumber(),
      date: new Date().toISOString(),
      inspectedBy: inspectorName,
      rooms: roomsData,
      status: status,
      isCompleted: status === 'completed',

      // Auto-hämtad residence-info
      residence: createResidenceInfo(residence),

      // Data från formuläret
      needsMasterKey: additionalData.needsMasterKey,
      tenant: additionalData.tenant,
    }

    // Spara till localStorage
    const existingInspections = JSON.parse(
      localStorage.getItem('inspections') || '[]'
    )
    localStorage.setItem(
      'inspections',
      JSON.stringify([...existingInspections, newInspection])
    )

    const toastTitle =
      status === 'draft' ? 'Utkast sparat' : 'Besiktning sparad'
    const toastDescription =
      status === 'draft'
        ? `Utkastet av ${inspectorName} har sparats. Du kan återuppta besiktningen senare.`
        : `Besiktningen genomförd av ${inspectorName} har sparats.`

    toast({
      title: toastTitle,
      description: toastDescription,
    })

    onInspectionCreated()
    setIsDialogOpen(false)
  }

  const renderInspectionsTable = (inspectionsData: Inspection[]) => (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nr</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead>Besiktningsman</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Antal rum</TableHead>
            <TableHead className="text-right">Åtgärder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspectionsData.map((inspection) => (
            <TableRow key={inspection.id} className="group">
              <TableCell className="font-mono text-sm">
                {inspection.inspectionNumber || '-'}
              </TableCell>
              <TableCell>
                {format(new Date(inspection.date), 'yyyy-MM-dd')}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span>{inspection.inspectedBy}</span>
                  {inspection.status === 'draft' && (
                    <Badge variant="secondary" className="w-fit">
                      Utkast
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {inspection.status === 'completed' ||
                inspection.isCompleted ||
                Object.values(inspection.rooms).every((room) => room.isHandled)
                  ? 'Slutförd'
                  : inspection.status === 'draft'
                    ? 'Utkast'
                    : 'Pågående'}
              </TableCell>
              <TableCell>{Object.keys(inspection.rooms).length}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenInspection(inspection)}
                >
                  Visa detaljer
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Skapa ny
        </Button>
        {inspections.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.removeItem('inspections')
              onInspectionCreated()
            }}
            className="text-xs"
          >
            Rensa alla
          </Button>
        )}
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
          <TabsTrigger value="active">Pågående</TabsTrigger>
          <TabsTrigger value="history">Historik</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeInspection ? (
            renderInspectionsTable([activeInspection])
          ) : (
            <p className="text-slate-500 p-2">
              Ingen aktiv besiktning för denna lägenhet.
            </p>
          )}
        </TabsContent>

        <TabsContent value="history">
          {completedInspections.length > 0 ? (
            renderInspectionsTable(completedInspections)
          ) : (
            <p className="text-slate-500 p-2">
              Ingen besiktningshistorik för denna lägenhet.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {isDialogOpen && (
        <InspectionFormDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSubmit={handleSubmit}
          rooms={rooms}
          tenant={tenant}
        />
      )}

      {selectedInspection && (
        <InspectionReadOnly
          inspection={selectedInspection}
          isOpen={isViewDialogOpen}
          onClose={() => setIsViewDialogOpen(false)}
        />
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-in">
      <Grid cols={1}>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </Grid>
    </div>
  )
}
