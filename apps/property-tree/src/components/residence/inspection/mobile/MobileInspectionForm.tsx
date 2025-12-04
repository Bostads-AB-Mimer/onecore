import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/v2/Button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v2/Badge'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { ChevronLeft, ChevronRight, CheckCircle2, User } from 'lucide-react'
import type { Room } from '@/services/types'
import type { InspectionRoom as InspectionRoomType } from '@/components/residence/inspection/types'
import { useInspectionForm } from '@/components/hooks/useInspectionForm'
import { InspectionProgressIndicator } from './InspectionProgressIndicator'
import { RoomInspectionMobile } from './RoomInspectionMobile'
import { InspectorSelectionCard } from './InspectorSelectionCard'

interface MobileInspectionFormProps {
  rooms: Room[]
  onSave: (
    inspectorName: string,
    rooms: Record<string, InspectionRoomType>
  ) => void
  onCancel: () => void
  tenant?: any
}

export function MobileInspectionForm({
  rooms,
  onSave,
  onCancel,
  tenant,
}: MobileInspectionFormProps) {
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0)
  const [showInspectorSelection, setShowInspectorSelection] = useState(true)
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
  } = useInspectionForm(rooms)

  const currentRoom = rooms[currentRoomIndex]
  const completedRooms = rooms.filter(
    (room) => inspectionData[room.id]?.isHandled
  ).length

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

  const handleSubmit = () => {
    onSave(inspectorName, inspectionData)
  }

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
            <InspectorSelectionCard
              inspectorName={inspectorName}
              setInspectorName={setInspectorName}
              inspectionTime={inspectionTime}
              setInspectionTime={setInspectionTime}
              needsMasterKey={needsMasterKey}
              setNeedsMasterKey={setNeedsMasterKey}
              tenant={tenant}
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
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <InspectionProgressIndicator
          current={completedRooms}
          total={rooms.length}
          currentRoomName={currentRoom.name}
        />

        <div className="flex items-center justify-between px-4 py-3">
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
      <div className="px-6 py-4">
        <div
          className="flex gap-3 overflow-x-auto pb-3 px-1 scrollbar-hide"
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
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setCurrentRoomIndex(index)}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {isCompleted && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    <span className="text-sm font-medium leading-tight">
                      {room.name}
                    </span>
                  </div>
                  <Badge
                    variant={isCompleted ? 'default' : 'outline'}
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

      {/* Current Room Inspection */}
      <div className="flex-1 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="px-4 pb-4">
            <RoomInspectionMobile
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
            />
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentRoomIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Föregående
          </Button>

          {currentRoomIndex === rooms.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!canComplete}
              className="flex-1"
            >
              Slutför besiktning
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              Nästa
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
