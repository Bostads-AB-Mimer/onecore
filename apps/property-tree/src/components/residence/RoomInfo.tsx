import { useState } from 'react'
import { useIsMobile } from '../hooks/useMobile'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/v2/Card'
import { useQuery } from '@tanstack/react-query'
import { roomService, componentService } from '@/services/api/core'
import { getOrientationText } from './get-room-orientation'
import { Grid } from '../ui/Grid'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/Accordion'
import { ComponentCard } from './ComponentCard'
import { Button } from '../ui/v2/Button'
import { Plus } from 'lucide-react'
import { ManageRoomComponentsDialog } from './ManageRoomComponentsDialog'

interface RoomInfoProps {
  residenceId: string
}

interface RoomComponentsProps {
  roomId: string
  propertyObjectId: string
  roomName?: string
}

const RoomComponents = ({ roomId, propertyObjectId, roomName }: RoomComponentsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const componentsQuery = useQuery({
    queryKey: ['components', propertyObjectId],
    queryFn: () => componentService.getByRoomId(propertyObjectId),
  })

  if (componentsQuery.isLoading) {
    return (
      <div className="py-4">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (componentsQuery.error || !componentsQuery.data) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground text-sm">
          Kunde inte hämta komponenter
        </p>
      </div>
    )
  }

  const hasComponents = componentsQuery.data.length > 0

  const sortedComponents = hasComponents ? componentsQuery.data : []

  return (
    <>
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">
            Komponenter
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Lägg till/Ta bort komponent
          </Button>
        </div>
        {hasComponents ? (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {sortedComponents.map((component) => (
              <ComponentCard key={component.id} component={component} />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              Inga komponenter installerade ännu
            </p>
          </div>
        )}
      </div>

      <ManageRoomComponentsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        roomId={roomId}
        propertyObjectId={propertyObjectId}
        roomName={roomName}
      />
    </>
  )
}

export const RoomInfo = (props: RoomInfoProps) => {
  const roomsQuery = useQuery({
    queryKey: ['rooms', props.residenceId],
    queryFn: () => roomService.getByResidenceId(props.residenceId),
  })

  const isMobile = useIsMobile()

  if (roomsQuery.isLoading) {
    return <LoadingSkeleton />
  }

  if (roomsQuery.error || !roomsQuery.data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Rum hittades inte
        </h2>
      </div>
    )
  }

  const rooms = roomsQuery.data
  return (
    <>
      <div
        className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'md:grid-cols-2 gap-6'}`}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Rumsöversikt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              Totalt antal rum: {rooms.length}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Uppvärmda rum</p>
                <p className="font-medium">
                  {rooms.filter((room) => room.features.isHeated).length}
                </p>
              </div>
              {/* Hiding for demo purposes */}
              {/*
              <div>
                <p className="text-sm text-muted-foreground">
                  Med termostatventil
                </p>
                <p className="font-medium">
                  {
                    rooms.filter((room) => room.features.hasThermostatValve)
                      .length
                  }
                </p>
              </div>
              */}
            </div>
          </CardContent>
        </Card>

        {/* Hiding for demo purposes */}
        {/*
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Orientering</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((orientation) => (
                <div key={orientation}>
                  <p className="text-sm text-muted-foreground">
                    {getOrientationText(orientation)}
                  </p>
                  <p className="font-medium">
                    {
                      rooms.filter(
                        (room) => room.features.orientation === orientation
                      ).length
                    }{' '}
                    rum
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        */}
      </div>

      <div className="mt-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">
          Rumsinformation ({rooms.length})
        </h2>
        <Accordion type="single" collapsible className="space-y-2">
          {rooms.map((room) => {
            const roomArea = (room as any).propertyObject?.quantityValues?.find(
              (qv: any) => qv.quantityTypeId === 'NTA'
            )?.value

            return (
              <AccordionItem
                key={room.id}
                value={room.id}
                className="border rounded-lg bg-card overflow-hidden"
              >
                <AccordionTrigger className="px-3 sm:px-4 hover:bg-accent/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 flex-1 text-left mr-2">
                    <span className="font-medium">
                      {room.name || room.roomType?.name || room.code}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {room.code}
                    </span>
                    {roomArea && (
                      <span className="text-sm text-muted-foreground">
                        ({roomArea} m²)
                      </span>
                    )}
                  </div>
                </AccordionTrigger>

                <AccordionContent className="border-t bg-muted/30 space-y-4 pt-4">
                  <div
                    className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4`}
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">Typ</p>
                      <p className="font-medium">
                        {room.roomType?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Orientering
                      </p>
                      <p className="font-medium">
                        {getOrientationText(room.features.orientation)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium">
                        {room.deleted ? 'Borttagen' : 'Aktiv'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Delat utrymme
                      </p>
                      <p className="font-medium">
                        {room.usage.shared ? 'Ja' : 'Nej'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4`}
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">Uppvärmd</p>
                      <p className="font-medium">
                        {room.features.isHeated ? 'Ja' : 'Nej'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Termostatventil
                      </p>
                      <p className="font-medium">
                        {room.features.hasThermostatValve ? 'Ja' : 'Nej'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Toalett</p>
                      <p className="font-medium">
                        {room.features.hasToilet ? 'Ja' : 'Nej'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Periodiskt arbete
                      </p>
                      <p className="font-medium">
                        {room.usage.allowPeriodicWorks
                          ? 'Tillåtet'
                          : 'Ej tillåtet'}
                      </p>
                    </div>
                  </div>

                  <RoomComponents
                    roomId={room.id}
                    propertyObjectId={(room as any).propertyObjectId}
                    roomName={room.name || room.roomType?.name || room.code}
                  />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-in">
      <Grid cols={2}>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </Grid>
    </div>
  )
}
