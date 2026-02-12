import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, User } from 'lucide-react'

import type {
  InspectionSubmitData,
  TenantSnapshot,
} from '@/features/inspections/types/index'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { ScrollArea } from '@/shared/ui/ScrollArea'

import { useInspectionForm } from '../../hooks/useInspectionForm'
import { InspectorSelectionCard } from '../InspectorSelectionCard'
import { RoomInspectionEditor } from '../RoomInspectionEditor'
import { InspectionProgressIndicator } from './InspectionProgressIndicator'
type Inspection = components['schemas']['Inspection']
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
  tenant?: any
  existingInspection?: Inspection
}

export function MobileInspectionForm({
  rooms,
  onSave,
  onCancel,
  tenant,
  existingInspection,
}: MobileInspectionFormProps) {
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0)
  // If we have existing inspection data, skip inspector selection
  const [showInspectorSelection, setShowInspectorSelection] =
    useState(!existingInspection)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
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

  const currentRoom = rooms[currentRoomIndex]
  const completedRooms = rooms.filter(
    (room) => inspectionData[room.id]?.isHandled
  ).length

  // Create tenant snapshot for saving
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

  const handleNext = () => {
    if (currentRoomIndex < rooms.length - 1) {
      setCurrentRoomIndex(currentRoomIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentRoomIndex > 0) {
      setCurrentRoomIndex(currentRoomIndex - 1)
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

  const canComplete =
    inspectorName && inspectionTime && completedRooms === rooms.length

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
            {/* <InspectorSelectionCard
              inspectorName={inspectorName}
              setInspectorName={setInspectorName}
              inspectionTime={inspectionTime}
              setInspectionTime={setInspectionTime}
              needsMasterKey={needsMasterKey}
              setNeedsMasterKey={setNeedsMasterKey}
              tenant={tenant}
            /> */}

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
            />
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentRoomIndex === 0}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Föregående
            </Button>

            {/* {currentRoomIndex === rooms.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={!canComplete}
                className="flex-1"
              >
                Slutför
              </Button>
            ) : (
              <Button onClick={handleNext} className="flex-1">
                Nästa
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )} */}
          </div>
          {/* <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={!inspectorName.trim()}
            className="w-full"
          >
            Spara utkast
          </Button> */}
        </div>
      </div>
    </div>
  )
}
