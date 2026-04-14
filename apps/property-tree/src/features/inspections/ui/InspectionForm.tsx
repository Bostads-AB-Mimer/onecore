import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import type {
  InspectionSubmitData,
  TenantInfoCardData,
  TenantSnapshot,
} from '@/features/inspections/types/index'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/AlertDialog'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

import { useInspectionForm } from '../hooks/useInspectionForm'
import { InspectionInfoSection } from './InspectionInfoSection'
import { RoomInspectionEditor } from './RoomInspectionEditor'
type Inspection = components['schemas']['InternalInspection']
type InspectionRoom = components['schemas']['InspectionRoom']

interface InspectionFormProps {
  rooms: Room[]
  onSave: (
    inspectorName: string,
    rooms: Record<string, InspectionRoom>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => void
  onCancel: () => void
  tenant?: TenantInfoCardData
  address?: string
  apartmentCode?: string | null
  existingInspection?: Inspection
}

const currentUser = 'Anna Andersson'

export function InspectionForm({
  rooms,
  onSave,
  onCancel,
  tenant,
  address,
  apartmentCode,
  existingInspection,
}: InspectionFormProps) {
  const {
    inspectorName,
    setInspectorName,
    needsMasterKey,
    inspectionData,
    handleConditionUpdate,
    handleActionUpdate,
    handleComponentNoteUpdate,
    handleComponentPhotoAdd,
    handleComponentPhotoRemove,
  } = useInspectionForm(rooms, existingInspection)

  useEffect(() => {
    if (!inspectorName && currentUser && !existingInspection) {
      setInspectorName(currentUser)
    }
  }, [inspectorName, setInspectorName, existingInspection])

  const completedRooms = Object.values(inspectionData).filter(
    (room) => room.isHandled
  ).length

  const canComplete = inspectorName && completedRooms === rooms.length

  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false)

  const createTenantSnapshot = (): TenantSnapshot | undefined => {
    if (!tenant) return undefined
    return {
      name: tenant.fullName ?? '',
      personalNumber: '',
    }
  }

  const handleSubmit = () => {
    if (canComplete) {
      onSave(inspectorName, inspectionData, 'completed', {
        needsMasterKey,
        tenant: createTenantSnapshot(),
      })
    }
  }

  const handleConfirmSaveDraft = () => {
    onSave(inspectorName, inspectionData, 'draft', {
      needsMasterKey,
      tenant: createTenantSnapshot(),
    })
    setIsDraftConfirmOpen(false)
  }

  return (
    <div className="space-y-6 min-w-0">
      <InspectionInfoSection
        inspectorName={inspectorName}
        setInspectorName={setInspectorName}
        tenant={tenant}
        address={address}
        apartmentCode={apartmentCode}
        layout="horizontal"
      />

      {/* Progress counter */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium">Besiktningsframsteg</span>
        <span className="text-sm text-muted-foreground">
          {completedRooms}/{rooms.length} rum klara
        </span>
      </div>

      {/* Room accordion */}
      <div className="max-h-[70vh] overflow-y-auto pr-2 pb-24 min-w-0">
        <Accordion type="multiple" className="space-y-2">
          {rooms.map((room) => {
            const roomData = inspectionData[room.id]
            const isCompleted = roomData?.isHandled

            return (
              <AccordionItem
                key={room.id}
                value={room.id}
                className="border rounded-lg"
              >
                <AccordionTrigger className="hover:no-underline sticky top-0 bg-background z-10">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{room.name}</span>
                    </div>
                    {isCompleted && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Klar
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pr-4 min-w-0">
                  <RoomInspectionEditor
                    room={room}
                    inspectionData={roomData}
                    onConditionUpdate={(field, value) =>
                      handleConditionUpdate(room.id, field, value)
                    }
                    onActionUpdate={(field, action) =>
                      handleActionUpdate(room.id, field, action)
                    }
                    onComponentNoteUpdate={(field, note) =>
                      handleComponentNoteUpdate(room.id, field, note)
                    }
                    onComponentPhotoAdd={(field, photoDataUrl) =>
                      handleComponentPhotoAdd(room.id, field, photoDataUrl)
                    }
                    onComponentPhotoRemove={(field, index) =>
                      handleComponentPhotoRemove(room.id, field, index)
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button
          variant="secondary"
          onClick={() => setIsDraftConfirmOpen(true)}
          disabled={!inspectorName.trim()}
        >
          Spara utkast
        </Button>

        <Button onClick={handleSubmit} disabled={!canComplete}>
          Slutför besiktning
        </Button>
      </div>

      <AlertDialog
        open={isDraftConfirmOpen}
        onOpenChange={setIsDraftConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Spara utkast?</AlertDialogTitle>
            <AlertDialogDescription>
              Dina framsteg sparas och du kan fortsätta besiktningen senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSaveDraft}>
              Spara utkast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
