import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, User } from 'lucide-react'

import type {
  InspectionSubmitData,
  TenantInfoCardData,
  TenantSnapshot,
} from '@/features/inspections/types/index'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { ScrollArea } from '@/shared/ui/ScrollArea'

import { useInspectionForm } from '../../hooks/useInspectionForm'
import { InspectionInfoSection } from '../InspectionInfoSection'
import { InspectionMoreMenu } from '../InspectionMoreMenu'
import { InspectionSummary } from '../InspectionSummary'
import { RoomInspectionEditor } from '../RoomInspectionEditor'
import { SaveDraftConfirmDialog } from '../SaveDraftConfirmDialog'
import { InspectionProgressIndicator } from './InspectionProgressIndicator'
type Inspection = components['schemas']['InternalInspection']
type InspectionRoom = components['schemas']['InspectionRoom']

interface MobileInspectionFormProps {
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

export function MobileInspectionForm({
  rooms: initialRooms,
  onSave,
  onCancel,
  tenant,
  address,
  apartmentCode,
  existingInspection,
  rentalId,
}: MobileInspectionFormProps) {
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0)
  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false)
  const [step, setStep] = useState<'rooms' | 'summary'>('rooms')
  // Show the inspector-selection landing screen for brand-new inspections
  // and for "start over" restarts. Continuing a draft has persisted room
  // data and skips straight into the form.
  const isContinuingExistingInspection = !!existingInspection?.rooms?.length
  const [showInspectorSelection, setShowInspectorSelection] = useState(
    !isContinuingExistingInspection
  )
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const {
    inspectorName,
    setInspectorName,
    needsMasterKey,
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

  // After adding a server-issued room, jump to it so the inspector can start
  // filling it in immediately. The new room is always appended, so its index
  // is the current length (before the state update completes, that length
  // equals the new room's index).
  const handleAddRoomAndNavigate = (room: import('@/services/types').Room) => {
    handleAddRoom(room)
    setCurrentRoomIndex(rooms.length)
  }

  const currentRoom = rooms[currentRoomIndex]
  const completedRooms = rooms.filter(
    (room) => inspectionData[room.id]?.isHandled
  ).length
  const isFirstRoom = currentRoomIndex === 0
  const isLastRoom = currentRoomIndex >= rooms.length - 1
  const canComplete = !!inspectorName.trim() && completedRooms === rooms.length

  // Create tenant snapshot for saving
  const createTenantSnapshot = (): TenantSnapshot | undefined => {
    if (!tenant) return undefined
    return {
      name: tenant.fullName ?? '',
      personalNumber: '',
    }
  }

  const handlePrevious = () => {
    if (!isFirstRoom) {
      setCurrentRoomIndex(currentRoomIndex - 1)
    }
  }

  const handleNext = () => {
    if (!isLastRoom) {
      setCurrentRoomIndex(currentRoomIndex + 1)
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

  const handleSubmit = () => {
    if (canComplete) {
      onSave(inspectorName, inspectionData, 'completed', {
        needsMasterKey,
        isFurnished,
        tenant: createTenantSnapshot(),
      })
    }
  }

  // Reset scroll position when room changes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (viewport) {
        viewport.scrollTop = 0
      }
    }
  }, [currentRoomIndex])

  if (showInspectorSelection) {
    return (
      <div className="h-full bg-background flex flex-col">
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Avbryt
            </Button>
            <h1 className="text-lg font-semibold">Ny besiktning</h1>
            <div className="w-16" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <InspectionInfoSection
              inspectorName={inspectorName}
              setInspectorName={setInspectorName}
              tenant={tenant}
              address={address}
              apartmentCode={apartmentCode}
            />

            <div className="pt-4 pb-20">
              <Button
                onClick={() => setShowInspectorSelection(false)}
                disabled={!inspectorName}
                className="w-full"
                size="lg"
              >
                Börja besiktning ({rooms.length} rum)
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Sticky Header with Room Navigation */}
      <div className="sticky top-0 z-10 bg-background shadow-sm">
        <div className="border-b">
          <InspectionProgressIndicator
            current={completedRooms}
            total={rooms.length}
            currentRoomName={currentRoom.name}
          />

          <div className="flex items-center justify-between px-4 py-[7px]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (step === 'summary') {
                  setStep('rooms')
                } else {
                  setShowInspectorSelection(true)
                }
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Tillbaka
            </Button>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {inspectorName}
              </span>
            </div>
          </div>
        </div>

        {step === 'rooms' && (
          /* Room Navigation Cards */
          <div className="px-4 py-2">
            <div
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {rooms.map((room, index) => {
                const isCompleted = inspectionData[room.id]?.isHandled
                const isCurrent = index === currentRoomIndex
                return (
                  <Card
                    key={room.id}
                    className={`min-w-[140px] cursor-pointer transition-all ${
                      isCurrent
                        ? 'ring-2 ring-inset ring-primary bg-primary/5'
                        : 'hover:ring-1 hover:ring-border'
                    }`}
                    onClick={() => setCurrentRoomIndex(index)}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="text-sm font-medium leading-tight uppercase">
                        {room.name}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs px-3 py-1 ${
                          isCompleted
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}
                      >
                        {isCompleted ? '✓ Klar' : 'Väntar'}
                      </Badge>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main content area — rooms or summary */}
      <div className="flex-1 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="px-4 pb-4">
            {step === 'rooms' && (
              <RoomInspectionEditor
                room={currentRoom}
                inspectionData={inspectionData[currentRoom.id]}
                inspectionId={existingInspection.id}
                onDetailComponentAdd={(component) =>
                  handleDetailComponentAdd(currentRoom.id, component)
                }
                onDetailComponentRemove={(componentId) =>
                  handleDetailComponentRemove(currentRoom.id, componentId)
                }
                onDetailComponentNoteUpdate={(componentId, note) =>
                  handleDetailComponentNoteUpdate(
                    currentRoom.id,
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
                    currentRoom.id,
                    componentId,
                    label,
                    value
                  )
                }
                onFetchedComponentActionUpdate={(componentId, label, action) =>
                  handleComponentActionUpdate(
                    currentRoom.id,
                    componentId,
                    label,
                    action
                  )
                }
                onFetchedComponentNoteUpdate={(componentId, label, note) =>
                  handleComponentNoteUpdateById(
                    currentRoom.id,
                    componentId,
                    label,
                    note
                  )
                }
                onFetchedComponentPhotoAdd={(componentId, label, photoPath) =>
                  handleComponentPhotoAddById(
                    currentRoom.id,
                    componentId,
                    label,
                    photoPath
                  )
                }
                onFetchedComponentPhotoRemove={(componentId, label, index) =>
                  handleComponentPhotoRemoveById(
                    currentRoom.id,
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
                    currentRoom.id,
                    componentId,
                    label,
                    value
                  )
                }
                onRoomHandledChange={(isHandled) =>
                  handleRoomHandledSet(currentRoom.id, isHandled)
                }
              />
            )}

            {step === 'summary' && (
              <div className="space-y-4 pt-2">
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
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-3">
        {step === 'rooms' ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              disabled={isFirstRoom}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Föregående rum</span>
            </Button>

            <InspectionMoreMenu
              rentalId={rentalId}
              inspectionId={existingInspection?.id}
              onRoomAdded={handleAddRoomAndNavigate}
            />

            <Button
              variant="secondary"
              onClick={() => setIsDraftConfirmOpen(true)}
              disabled={!inspectorName.trim()}
              className="flex-1"
            >
              Spara utkast
            </Button>

            {isLastRoom ? (
              <Button
                onClick={() => setStep('summary')}
                disabled={!inspectorName.trim()}
              >
                Sammanställning
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={isLastRoom}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Nästa rum</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setStep('rooms')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Rum
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsDraftConfirmOpen(true)}
              disabled={!inspectorName.trim()}
              className="flex-1"
            >
              Spara utkast
            </Button>
            <Button onClick={handleSubmit} disabled={!canComplete}>
              Slutför besiktning
            </Button>
          </div>
        )}
      </div>

      <SaveDraftConfirmDialog
        open={isDraftConfirmOpen}
        onOpenChange={setIsDraftConfirmOpen}
        onConfirm={handleConfirmSaveDraft}
      />
    </div>
  )
}
