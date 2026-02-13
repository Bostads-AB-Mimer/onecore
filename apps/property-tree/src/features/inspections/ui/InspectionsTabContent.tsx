import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import type {
  InspectionSubmitData,
  ResidenceInfo,
  TenantSnapshot,
} from '@/features/inspections/types'

import { inspectionService, roomService } from '@/services/api/core'
import { components } from '@/services/api/core/generated/api-types'
import type { ResidenceDetails } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import { InspectionProtocol } from '../ui/InspectionProtocol'
import { InspectionFormDialog } from './InspectionFormDialog'
import { InspectionsTable } from './InspectionsTable'

type Inspection = components['schemas']['Inspection']
// type InspectionRoom = components['schemas']['InspectionRoom']

interface InspectionsTabContentProps {
  residenceId: string
  rentalId: string | undefined
  onInspectionCreated?: () => void
  tenant?: any
  residence?: ResidenceDetails
}

// Generera besiktningsnummer
// TODO: is this something the frontend should do? This is copied from Lovable.
// const generateInspectionNumber = (): string => {
//   const year = new Date().getFullYear()
//   const randomNum = Math.floor(Math.random() * 1000)
//     .toString()
//     .padStart(3, '0')
//   return `B-${year}-${randomNum}`
// }

// Skapa ResidenceInfo från Residence
// const createResidenceInfo = (residence?: ResidenceDetails): ResidenceInfo => {
//   if (!residence) {
//     return {
//       id: '',
//       objectNumber: '',
//       address: 'Okänd adress',
//       apartmentType: null,
//       size: null,
//     }
//   }
//   return {
//     id: residence.id,
//     objectNumber: residence.code,
//     address: residence.name ?? '',
//     apartmentType:
//       residence.propertyObject.rentalInformation?.type.code ?? null,
//     size: residence.size,
//   }
// }

const INITIAL_DISPLAY_COUNT = 5

export function InspectionsTabContent({
  residenceId,
  rentalId,
  onInspectionCreated,
  tenant,
  residence,
}: InspectionsTabContentProps) {
  const [showAll, setShowAll] = useState(false)
  // const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  // const { toast } = useToast()

  const inspectionsQuery = useQuery({
    queryKey: ['inspections', rentalId],
    queryFn: () => inspectionService.getInspectionsForResidence(rentalId!),
    enabled: !!rentalId,
  })

  const inspections = inspectionsQuery.data ?? []

  // const roomsQuery = useQuery({
  //   queryKey: ['rooms', residenceId],
  //   queryFn: () => roomService.getByResidenceId(residenceId),
  // })

  // if (roomsQuery.isLoading) {
  //   return <LoadingSkeleton />
  // }

  // if (roomsQuery.error || !roomsQuery.data) {
  //   return (
  //     <div className="p-8 text-center">
  //       <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
  //         Rum hittades inte
  //       </h2>
  //     </div>
  //   )
  // }

  // const rooms = roomsQuery.data ?? []

  // Filter inspections by status (API-based inspections)
  const activeInspection = inspections.find(
    (inspection: Inspection) => inspection.status !== 'Genomförd'
  )

  const completedInspections = inspections.filter(
    (inspection: Inspection) => inspection.status === 'Genomförd'
  )

  // const handleSubmit = (
  //   inspectorName: string,
  //   roomsData: Record<string, InspectionRoomType>,
  //   status: 'draft' | 'completed',
  //   additionalData: InspectionSubmitData
  // ) => {
  //   const newInspection: LocalInspection = {
  //     _tag: 'internal',
  //     id: `inspection-${Date.now()}`,
  //     inspectionNumber: generateInspectionNumber(),
  //     date: new Date().toISOString(),
  //     inspectedBy: inspectorName,
  //     rooms: roomsData,
  //     status: status,
  //     isCompleted: status === 'completed',

  //     // Auto-hämtad residence-info
  //     residence: createResidenceInfo(residence),

  //     // Data från formuläret
  //     needsMasterKey: additionalData.needsMasterKey,
  //     tenant: additionalData.tenant,
  //   }

  //   // Spara till localStorage
  //   const existingInspections = JSON.parse(
  //     localStorage.getItem('inspections') || '[]'
  //   )
  //   localStorage.setItem(
  //     'inspections',
  //     JSON.stringify([...existingInspections, newInspection])
  //   )

  //   const toastTitle =
  //     status === 'draft' ? 'Utkast sparat' : 'Besiktning sparad'
  //   const toastDescription =
  //     status === 'draft'
  //       ? `Utkastet av ${inspectorName} har sparats. Du kan återuppta besiktningen senare.`
  //       : `Besiktningen genomförd av ${inspectorName} har sparats.`

  //   toast({
  //     title: toastTitle,
  //     description: toastDescription,
  //   })

  //   onInspectionCreated()
  //   setIsCreateDialogOpen(false)
  // }

  const renderInspectionsTable = (inspectionsData: Inspection[]) => {
    return (
      <InspectionsTable
        inspections={inspectionsData}
        hiddenColumns={['address']}
      />
    )
  }

  return (
    <TabLayout
      title="Besiktningar"
      showCard={true}
      isLoading={inspectionsQuery.isLoading}
    >
      {/* <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
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
      </div> */}

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
            <div className="space-y-4">
              {renderInspectionsTable(
                showAll
                  ? completedInspections
                  : completedInspections.slice(0, INITIAL_DISPLAY_COUNT)
              )}

              {completedInspections.length > INITIAL_DISPLAY_COUNT &&
                !showAll && (
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={() => setShowAll(true)}>
                      Se fler (
                      {completedInspections.length - INITIAL_DISPLAY_COUNT}{' '}
                      till)
                    </Button>
                  </div>
                )}

              {showAll &&
                completedInspections.length > INITIAL_DISPLAY_COUNT && (
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={() => setShowAll(false)}>
                      Visa färre
                    </Button>
                  </div>
                )}
            </div>
          ) : (
            <p className="text-slate-500 p-2">
              Ingen besiktningshistorik för denna lägenhet.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </TabLayout>
  )
}
