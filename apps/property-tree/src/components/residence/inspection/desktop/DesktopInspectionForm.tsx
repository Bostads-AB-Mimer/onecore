import { Button } from '@/components/ui/v2/Button'
import { TenantInformationCard } from '@/components/tenants/TenantInformationCard'
import { RoomInspectionMobile } from '../mobile/RoomInspectionMobile'
import { useInspectionForm } from '@/components/hooks/useInspectionForm'
import type { Room } from '@/services/types'
import type { InspectionRoom as InspectionRoomType } from '@/components/residence/inspection/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { Clock, CheckCircle2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import { Badge } from '@/components/ui/v2/Badge'
import { useEffect } from 'react'

interface DesktopInspectionFormProps {
  rooms: Room[]
  onSave: (
    inspectorName: string,
    rooms: Record<string, InspectionRoomType>
  ) => void
  onCancel: () => void
  tenant?: any
}

const inspectors = [
  'Anna Andersson',
  'Erik Eriksson',
  'Maria Nilsson',
  'Johan Johansson',
]

const currentUser = 'Anna Andersson'

export function DesktopInspectionForm({
  rooms,
  onSave,
  onCancel,
  tenant,
}: DesktopInspectionFormProps) {
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

  // Set default inspector if not already set
  useEffect(() => {
    if (!inspectorName && currentUser) {
      setInspectorName(currentUser)
    }
  }, [inspectorName, setInspectorName])

  const completedRooms = Object.values(inspectionData).filter(
    (room) => room.isHandled
  ).length

  const canComplete = inspectorName && completedRooms === rooms.length

  const handleSubmit = () => {
    if (canComplete) {
      onSave(inspectorName, inspectionData)
    }
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* Inspector selection + Tenant info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inspector Selection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Info om besiktning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Besiktigare</Label>
              <Select value={inspectorName} onValueChange={setInspectorName}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Välj vem som utför besiktningen" />
                </SelectTrigger>
                <SelectContent>
                  {inspectors.map((inspector) => (
                    <SelectItem key={inspector} value={inspector}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {inspector
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
                        {inspector}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="inspection-time"
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Klockslag för besiktning
              </Label>
              <div className="flex gap-2">
                <Select
                  value={inspectionTime.split(':')[0] || '09'}
                  onValueChange={(hour) => {
                    const currentMinute = inspectionTime.split(':')[1] || '00'
                    setInspectionTime(`${hour}:${currentMinute}`)
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Timme" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) =>
                      i.toString().padStart(2, '0')
                    ).map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="flex items-center px-2 text-muted-foreground">
                  :
                </span>
                <Select
                  value={inspectionTime.split(':')[1] || '00'}
                  onValueChange={(minute) => {
                    const currentHour = inspectionTime.split(':')[0] || '09'
                    setInspectionTime(`${currentHour}:${minute}`)
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Minut" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) =>
                      (i * 5).toString().padStart(2, '0')
                    ).map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Huvudnyckel</span>
              <span className="text-sm text-muted-foreground">Nej</span>
            </div>
          </CardContent>
        </Card>

        {/* Tenant info */}
        {tenant && <TenantInformationCard tenant={tenant} />}
      </div>

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
                      <span className="text-sm text-muted-foreground">
                        {/* {room.size} // property does not exist in schema. Design assumes it does. Decide what to do when we know what data exists. */}
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
                  <RoomInspectionMobile
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
        <Button onClick={handleSubmit} disabled={!canComplete}>
          Spara besiktning
        </Button>
      </div>
    </div>
  )
}
