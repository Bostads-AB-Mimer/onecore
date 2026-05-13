import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft } from 'lucide-react'

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
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

import { useInspectionForm } from '../hooks/useInspectionForm'
import { InspectionInfoSection } from './InspectionInfoSection'
import { InspectionMoreMenu } from './InspectionMoreMenu'
import { InspectionSummary } from './InspectionSummary'
import { RoomInspectionEditor } from './RoomInspectionEditor'
import { SaveDraftConfirmDialog } from './SaveDraftConfirmDialog'
type Inspection = components['schemas']['InternalInspection']
type InspectionRoom = components['schemas']['InspectionRoom']

interface InspectionFormProps {
  // Initial rooms from the property system. The form maintains its own
  // rooms state internally (via useInspectionForm) to support ad-hoc rooms
  // added by the inspector via InspectionMoreMenu.
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
  existingInspection: Inspection
  rentalId?: string
}

const currentUser = 'Anna Andersson'

export function InspectionForm({
  rooms: initialRooms,
  onSave,
  onCancel,
  tenant,
  address,
  apartmentCode,
  existingInspection,
  rentalId,
}: InspectionFormProps) {
  const {
    inspectorName,
    setInspectorName,
    needsMasterKey,
    setNeedsMasterKey,
    isFurnished,
    setIsFurnished,
    rooms,
    inspectionData,
    handleAddRoom,
    handleConditionUpdate,
    handleActionUpdate,
    handleComponentNoteUpdate,
    handleComponentPhotoAdd,
    handleComponentPhotoRemove,
    handleComponentCostResponsibilityUpdate,
    handleDetailComponentAdd,
    handleDetailComponentRemove,
    handleDetailComponentNoteUpdate,
    handleComponentConditionUpdate,
    handleComponentActionUpdate,
    handleComponentNoteUpdateById,
    handleComponentPhotoAddById,
    handleComponentPhotoRemoveById,
    handleComponentCostUpdateById,
    handleComponentCostResponsibilityUpdateById,
    handleRoomHandledSet,
  } = useInspectionForm(initialRooms, existingInspection)

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
  const [step, setStep] = useState<'rooms' | 'summary'>('rooms')

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
        isFurnished,
        tenant: createTenantSnapshot(),
      })
    }
  }

  const handleConfirmSaveDraft = () => {
    onSave(inspectorName, inspectionData, 'draft', {
      needsMasterKey,
      isFurnished,
      tenant: createTenantSnapshot(),
    })
    setIsDraftConfirmOpen(false)
  }

  return (
    <div className="flex flex-col overflow-hidden min-w-0 min-h-0 flex-1">
      {/* Scrollable area — info, progress, and rooms/summary all scroll together */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-6">
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

        {step === 'rooms' && (
          <Accordion type="multiple" className="space-y-2">
            {rooms.map((room) => {
              const roomData = inspectionData[room.id]
              const isCompleted = roomData?.isHandled

              return (
                <AccordionItem
                  key={room.id}
                  value={room.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="hover:no-underline sticky top-0 bg-background z-10">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium uppercase">
                          {room.name}
                        </span>
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
                      inspectionId={existingInspection?.id}
                      onConditionUpdate={(field, value) =>
                        handleConditionUpdate(room.id, field, value)
                      }
                      onActionUpdate={(field, action) =>
                        handleActionUpdate(room.id, field, action)
                      }
                      onComponentNoteUpdate={(field, note) =>
                        handleComponentNoteUpdate(room.id, field, note)
                      }
                      onComponentPhotoAdd={(field, photoPath) =>
                        handleComponentPhotoAdd(room.id, field, photoPath)
                      }
                      onComponentPhotoRemove={(field, index) =>
                        handleComponentPhotoRemove(room.id, field, index)
                      }
                      onComponentCostResponsibilityUpdate={(field, value) =>
                        handleComponentCostResponsibilityUpdate(
                          room.id,
                          field,
                          value
                        )
                      }
                      onDetailComponentAdd={(component) =>
                        handleDetailComponentAdd(room.id, component)
                      }
                      onDetailComponentRemove={(componentId) =>
                        handleDetailComponentRemove(room.id, componentId)
                      }
                      onDetailComponentNoteUpdate={(componentId, note) =>
                        handleDetailComponentNoteUpdate(
                          room.id,
                          componentId,
                          note
                        )
                      }
                      onFetchedComponentConditionUpdate={(
                        componentId,
                        label,
                        value
                      ) =>
                        handleComponentConditionUpdate(
                          room.id,
                          componentId,
                          label,
                          value
                        )
                      }
                      onFetchedComponentActionUpdate={(
                        componentId,
                        label,
                        action
                      ) =>
                        handleComponentActionUpdate(
                          room.id,
                          componentId,
                          label,
                          action
                        )
                      }
                      onFetchedComponentNoteUpdate={(
                        componentId,
                        label,
                        note
                      ) =>
                        handleComponentNoteUpdateById(
                          room.id,
                          componentId,
                          label,
                          note
                        )
                      }
                      onFetchedComponentPhotoAdd={(
                        componentId,
                        label,
                        photoPath
                      ) =>
                        handleComponentPhotoAddById(
                          room.id,
                          componentId,
                          label,
                          photoPath
                        )
                      }
                      onFetchedComponentPhotoRemove={(
                        componentId,
                        label,
                        index
                      ) =>
                        handleComponentPhotoRemoveById(
                          room.id,
                          componentId,
                          label,
                          index
                        )
                      }
                      onFetchedComponentCostResponsibilityUpdate={(
                        componentId,
                        label,
                        value
                      ) =>
                        handleComponentCostResponsibilityUpdateById(
                          room.id,
                          componentId,
                          label,
                          value
                        )
                      }
                      onRoomHandledChange={(isHandled) =>
                        handleRoomHandledSet(room.id, isHandled)
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}

        {step === 'summary' && (
          <>
            <Button
              variant="link"
              onClick={() => setStep('rooms')}
              className="h-auto p-0"
            >
              <ChevronLeft />
              Tillbaka till rum
            </Button>
            <InspectionSummary
              inspectionData={inspectionData}
              rooms={rooms}
              onComponentCostByIdUpdate={handleComponentCostUpdateById}
              onComponentCostResponsibilityByIdUpdate={
                handleComponentCostResponsibilityUpdateById
              }
            />
            <div
              className="p-4 border rounded-lg space-y-3"
              role="radiogroup"
              aria-label="Är bostaden möblerad vid besiktningstillfället?"
            >
              <div className="text-sm font-medium">
                Är bostaden möblerad vid besiktningstillfället?
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  role="radio"
                  aria-checked={isFurnished}
                  variant={isFurnished ? 'default' : 'outline'}
                  onClick={() => setIsFurnished(true)}
                >
                  Ja
                </Button>
                <Button
                  type="button"
                  role="radio"
                  aria-checked={!isFurnished}
                  variant={!isFurnished ? 'default' : 'outline'}
                  onClick={() => setIsFurnished(false)}
                >
                  Nej
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer — always visible at the bottom */}
      <div className="shrink-0 flex gap-3 justify-between pt-4 border-t">
        <InspectionMoreMenu
          rentalId={rentalId}
          variant="buttons"
          onAddRoom={handleAddRoom}
        />
        <div className="flex gap-3">
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

          {step === 'rooms' && (
            <Button
              onClick={() => setStep('summary')}
              disabled={!inspectorName.trim()}
            >
              Sammanställning
            </Button>
          )}
          {step === 'summary' && (
            <Button onClick={handleSubmit} disabled={!canComplete}>
              Slutför besiktning
            </Button>
          )}
        </div>
      </div>

      <SaveDraftConfirmDialog
        open={isDraftConfirmOpen}
        onOpenChange={setIsDraftConfirmOpen}
        onConfirm={handleConfirmSaveDraft}
      />
    </div>
  )
}
