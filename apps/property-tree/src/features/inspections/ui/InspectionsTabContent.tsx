import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { inspectionService, roomService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import type { ResidenceDetails } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import { INSPECTION_STATUS } from '../constants/statuses'
import { useCreateInspection } from '../hooks/useCreateInspection'
import { CreateInspectionDialog } from './CreateInspectionDialog'
import { InspectionsTable } from './InspectionsTable'

type Inspection = components['schemas']['Inspection']

interface InspectionsTabContentProps {
  residenceId: string
  rentalId: string | undefined
  leaseId: string | undefined
  residence?: ResidenceDetails
}

const INITIAL_DISPLAY_COUNT = 5

export function InspectionsTabContent({
  residenceId,
  rentalId,
  leaseId,
  residence,
}: InspectionsTabContentProps) {
  const [showAll, setShowAll] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { toast } = useToast()

  const inspectionsQuery = useQuery({
    queryKey: ['inspections', rentalId],
    queryFn: () => inspectionService.getInspectionsForResidence(rentalId!),
    enabled: !!rentalId,
  })

  const roomsQuery = useQuery({
    queryKey: ['rooms', residenceId],
    queryFn: () => roomService.getByResidenceId(residenceId),
    enabled: !!residenceId,
  })

  const createInspection = useCreateInspection({ rentalId })

  const inspections = inspectionsQuery.data ?? []

  const activeInspection = inspections.find(
    (inspection: Inspection) =>
      inspection.status !== INSPECTION_STATUS.COMPLETED
  )

  const completedInspections = inspections.filter(
    (inspection: Inspection) =>
      inspection.status === INSPECTION_STATUS.COMPLETED
  )

  const renderInspectionsTable = (inspectionsData: Inspection[]) => {
    return (
      <InspectionsTable
        inspections={inspectionsData}
        hiddenColumns={['address']}
      />
    )
  }

  const address = residence?.name ?? ''
  const apartmentCode = residence?.code ?? null

  return (
    <TabLayout
      title="Besiktningar"
      showCard={true}
      isLoading={inspectionsQuery.isLoading}
    >
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
          disabled={!leaseId}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Skapa ny
        </Button>
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

      {leaseId && (
        <CreateInspectionDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onSubmit={(data) => {
            createInspection.mutate(data, {
              onSuccess: () => {
                toast({
                  title: 'Besiktning skapad',
                  description: `Besiktning skapad av ${data.inspector}.`,
                })
                setIsCreateDialogOpen(false)
              },
              onError: () => {
                toast({
                  title: 'Fel',
                  description: 'Kunde inte skapa besiktning.',
                  variant: 'destructive',
                })
              },
            })
          }}
          isSubmitting={createInspection.isPending}
          residenceId={residenceId}
          address={address}
          apartmentCode={apartmentCode}
          leaseId={leaseId}
          roomNames={(roomsQuery.data ?? []).map((r) => r.name ?? r.code)}
        />
      )}
    </TabLayout>
  )
}
