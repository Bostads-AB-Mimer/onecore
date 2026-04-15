import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, User } from 'lucide-react'

import type {
  InspectionSubmitData,
  TenantInfoCardData,
  TenantSnapshot,
} from '@/features/inspections/types/index'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { getFloorplanUrl } from '@/shared/lib/floorplan'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { ScrollArea } from '@/shared/ui/ScrollArea'

import { useInspectionForm } from '../../hooks/useInspectionForm'
import { InspectionInfoSection } from '../InspectionInfoSection'
import { InspectionMoreMenu } from '../InspectionMoreMenu'
import { RoomInspectionEditor } from '../RoomInspectionEditor'
import { InspectionProgressIndicator } from './InspectionProgressIndicator'
type Inspection = components['schemas']['InternalInspection']
type InspectionRoom = components['schemas']['InspectionRoom']

interface MobileInspectionFormProps {
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
  rentalId?: string
}

export function MobileInspectionForm({
  rooms,
  onSave,
  onCancel,
  tenant,
  address,
  apartmentCode,
  existingInspection,
  rentalId,
}: MobileInspectionFormProps) {
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0)
  // Show the inspector-selection landing screen for brand-new inspections
  // and for "start over" restarts. Continuing a draft has persisted room
  // data and skips straight into the form.
  const isContinuingExistingInspection = !!existingInspection?.rooms?.length
  const [showInspectorSelection, setShowInspectorSelection] = useState(
    !isContinuingExistingInspection
  )
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  // TODO: mobile form does not yet have the Sammanställning step or the
  // `isFurnished` Ja/Nej toggle wired up in InspectionForm.tsx (MIM-1676).
  // When the commented-out save handlers below are re-enabled, destructure
  // `isFurnished` / `setIsFurnished` from useInspectionForm and include
  // `isFurnished` in the additionalData payloads, otherwise the mobile flow
  // will silently drop the value on both draft save and complete.
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
    handleDetailComponentAdd,
    handleDetailComponentRemove,
    handleDetailComponentNoteUpdate,
  } = useInspectionForm(rooms, existingInspection)

  const floorplanImage = rentalId ? getFloorplanUrl(rentalId) : undefined
  const currentRoom = rooms[currentRoomIndex]
  const completedRooms = rooms.filter(
    (room) => inspectionData[room.id]?.isHandled
  ).length
  const isFirstRoom = currentRoomIndex === 0
  const isLastRoom = currentRoomIndex >= rooms.length - 1

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

  const handleSaveDraft = () => {
    if (inspectorName.trim()) {
      onSave(inspectorName, inspectionData, 'draft', {
        needsMasterKey,
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
              onClick={() => setShowInspectorSelection(true)}
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

        {/* Room Navigation Cards */}
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
                    <div className="text-sm font-medium leading-tight">
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
      </div>

      {/* Current Room Inspection */}
      <div className="flex-1 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="px-4 pb-4">
            <RoomInspectionEditor
              room={currentRoom}
              inspectionData={inspectionData[currentRoom.id]}
              onConditionUpdate={(field, value) =>
                handleConditionUpdate(currentRoom.id, field, value)
              }
              onActionUpdate={(field, action) =>
                handleActionUpdate(currentRoom.id, field, action)
              }
              onComponentNoteUpdate={(field, note) =>
                handleComponentNoteUpdate(currentRoom.id, field, note)
              }
              onComponentPhotoAdd={(field, photoDataUrl) =>
                handleComponentPhotoAdd(currentRoom.id, field, photoDataUrl)
              }
              onComponentPhotoRemove={(field, index) =>
                handleComponentPhotoRemove(currentRoom.id, field, index)
              }
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
            />
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-3">
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

          <InspectionMoreMenu floorplanImage={floorplanImage} />

          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={!inspectorName.trim()}
            className="flex-1"
          >
            Spara utkast
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={isLastRoom}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Nästa rum</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
