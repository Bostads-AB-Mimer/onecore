import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TabLayout } from '@/shared/ui/TabLayout'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'

import { useRooms, RoomOverviewCards, RoomDetails } from '@/features/rooms'
import { SpaceComponents } from '@/features/component-library'

type RoomsTabContentProps =
  | { residenceId: string; facilityId?: never }
  | { residenceId?: never; facilityId: string }

export const RoomsTabContent = (props: RoomsTabContentProps) => {
  const [searchParams] = useSearchParams()
  const roomCodeFromUrl = searchParams.get('room')
  const [openRoomId, setOpenRoomId] = useState<string | undefined>(undefined)
  const roomRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const roomsQuery = useRooms(props)
  const rooms = roomsQuery.data || []

  // Auto-open room accordion when navigating from component library
  useEffect(() => {
    if (roomCodeFromUrl && rooms.length > 0) {
      const matchingRoom = rooms.find((r) => r.code === roomCodeFromUrl)
      if (matchingRoom) {
        setOpenRoomId(matchingRoom.id)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const element = roomRefs.current.get(matchingRoom.id)
            element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        })
      }
    }
  }, [roomCodeFromUrl, rooms])

  return (
    <TabLayout
      title="Rumsinformation"
      showCard={true}
      isLoading={roomsQuery.isLoading}
      error={roomsQuery.error as Error | null}
      errorMessage="Rum hittades inte"
    >
      <RoomOverviewCards rooms={rooms} />

      <div className="mt-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">
          Rumsinformation ({rooms.length})
        </h2>
        <Accordion
          type="single"
          collapsible
          className="space-y-2"
          value={openRoomId}
          onValueChange={setOpenRoomId}
        >
          {rooms.map((room) => (
            <AccordionItem
              key={room.id}
              value={room.id}
              ref={(el) => {
                if (el) roomRefs.current.set(room.id, el)
              }}
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
                </div>
              </AccordionTrigger>

              <AccordionContent className="border-t bg-muted/30 space-y-4 pt-4">
                <RoomDetails room={room} />
                <SpaceComponents
                  spaceId={(room as any).propertyObjectId}
                  spaceName={`Rum: ${room.name || room.roomType?.name || room.code}`}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </TabLayout>
  )
}
