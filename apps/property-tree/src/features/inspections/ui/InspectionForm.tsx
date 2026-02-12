import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

import type {
  InspectionSubmitData,
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
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

import { useInspectionForm } from '../hooks/useInspectionForm'
import { InspectorSelectionCard } from './InspectorSelectionCard'
import { RoomInspectionEditor } from './RoomInspectionEditor'

type Inspection = components['schemas']['Inspection']
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
  tenant?: any
  existingInspection?: Inspection
}

const currentUser = 'Anna Andersson'

export function InspectionForm({
  rooms,
  onSave,
  onCancel,
  tenant,
  existingInspection,
}: InspectionFormProps) {
  const {
    inspectorName,
    setInspectorName,
    inspectionTime,
    setInspectionTime,
    needsMasterKey,
    setNeedsMasterKey,
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

  const createTenantSnapshot = (): TenantSnapshot | undefined => {
    if (!tenant) return undefined
    return {
      name:
        `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() ||
        tenant.name ||
        '',
      personalNumber: tenant.personalNumber || '',
      phone: tenant.phone,
      email: tenant.email,
    }
  }

  // const handleSubmit = () => {
  //   if (canComplete) {
  //     onSave(inspectorName, inspectionData, 'completed', {
  //       needsMasterKey,
  //       tenant: createTenantSnapshot(),
  //     })
  //   }
  // }

  // const handleSaveDraft = () => {
  //   if (inspectorName.trim()) {
  //     onSave(inspectorName, inspectionData, 'draft', {
  //       needsMasterKey,
  //       tenant: createTenantSnapshot(),
  //     })
  //   }
  // }

  return (
    <div className="space-y-6 min-w-0">
      {/* Reuse the same card component with horizontal layout for desktop */}
      {/* <InspectorSelectionCard
        inspectorName={inspectorName}
        setInspectorName={setInspectorName}
        inspectionTime={inspectionTime}
        setInspectionTime={setInspectionTime}
        needsMasterKey={needsMasterKey}
        setNeedsMasterKey={setNeedsMasterKey}
        tenant={tenant}
        layout="horizontal"
      /> */}

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
        {/* <Button
          variant="secondary"
          onClick={handleSaveDraft}
          disabled={!inspectorName.trim()}
        >
          Spara utkast
        </Button>
        <Button onClick={handleSubmit} disabled={!canComplete}>
          Slutför besiktning
        </Button> */}
      </div>
    </div>
  )
}
