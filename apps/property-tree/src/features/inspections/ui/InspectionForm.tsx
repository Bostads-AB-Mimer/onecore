import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, Plus, Trash2 } from 'lucide-react'

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
import { RemoveInspectionRoomDialog } from './RemoveInspectionRoomDialog'
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
    handleRemoveRoom,
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
    handleMarkRoomNoRemarks,
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
  const [removeTargetRoomId, setRemoveTargetRoomId] = useState<string | null>(
    null
  )
  // Controlled accordion so the room navigator can programmatically open a
  // room when the inspector clicks its pill.
  const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([])
  // Tracks which room is currently in the inspector's viewport so its pill
  // can be highlighted in the sticky navigator.
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const roomRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const handleSelectRoom = (roomId: string) => {
    setExpandedRoomIds((prev) =>
      prev.includes(roomId) ? prev : [...prev, roomId]
    )
    // Defer the scroll a tick so the accordion has time to expand before we
    // measure offsets — otherwise scrollIntoView lands above the target.
    requestAnimationFrame(() => {
      roomRefs.current[roomId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  // Stable key so the observer effect doesn't re-run on every render just
  // because the parent handed us a fresh `rooms` array reference.
  const roomIdsKey = rooms.map((r) => r.id).join(',')

  // Highlight the pill for whichever room is currently in view. The rootMargin
  // shrinks the observed band to the top half of the scroll container so the
  // active pill matches the room the inspector is actually reading, not the
  // one that just scrolled into the bottom edge.
  useEffect(() => {
    if (step !== 'rooms') return
    const root = scrollContainerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length === 0) return
        const id = visible[0].target.getAttribute('data-room-id')
        if (id) setActiveRoomId(id)
      },
      { root, rootMargin: '-10% 0px -60% 0px', threshold: 0 }
    )
    for (const id of roomIdsKey.split(',')) {
      const el = roomRefs.current[id]
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdsKey, step])

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
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-6"
      >
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
          <>
            <div className="sticky top-0 z-20 -mt-2 pt-2 pb-2 bg-background border-b">
              <div
                className="flex gap-2 overflow-x-auto pb-1"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {rooms.map((room) => {
                  const isHandled = inspectionData[room.id]?.isHandled
                  const isActive = activeRoomId === room.id
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => handleSelectRoom(room.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        isActive
                          ? 'ring-2 ring-inset ring-primary bg-primary/5 border-primary'
                          : 'hover:bg-muted border-border'
                      }`}
                    >
                      <span className="font-medium uppercase">{room.name}</span>
                      {isHandled && (
                        <CheckCircle2 className="h-3 w-3 inline ml-1.5 text-green-600" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <Accordion
              type="multiple"
              value={expandedRoomIds}
              onValueChange={setExpandedRoomIds}
              className="space-y-2"
            >
              {rooms.map((room) => {
                const roomData = inspectionData[room.id]
                const isCompleted = roomData?.isHandled

                return (
                  <div
                    key={room.id}
                    ref={(el) => {
                      roomRefs.current[room.id] = el
                    }}
                    data-room-id={room.id}
                    className="scroll-mt-16"
                  >
                    <AccordionItem
                      value={room.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <span className="font-medium uppercase">
                              {room.name}
                            </span>
                            {roomData?.isAddedInThisInspection && (
                              <>
                                <Badge variant="secondary" className="gap-1">
                                  <Plus className="h-3 w-3" />
                                  Tillagt
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:text-destructive"
                                  aria-label="Ta bort rum"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setRemoveTargetRoomId(room.id)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
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
                          onMarkRoomNoRemarks={(components) =>
                            handleMarkRoomNoRemarks(room.id, components)
                          }
                          onRoomHandledChange={(isHandled) =>
                            handleRoomHandledSet(room.id, isHandled)
                          }
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </div>
                )
              })}
            </Accordion>
          </>
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
          inspectionId={existingInspection?.id}
          variant="buttons"
          onRoomAdded={handleAddRoom}
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

      <RemoveInspectionRoomDialog
        inspectionId={existingInspection.id}
        roomId={removeTargetRoomId}
        onOpenChange={(open) => {
          if (!open) setRemoveTargetRoomId(null)
        }}
        onRoomRemoved={handleRemoveRoom}
      />
    </div>
  )
}
