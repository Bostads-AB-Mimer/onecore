import { TabLayout } from '@/shared/ui/layout/TabLayout'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'

import {
  useRooms,
  useRoomDeepLink,
  getRoomDisplayName,
  RoomOverviewCards,
  RoomDetails,
} from '@/features/rooms'
import { SpaceComponents } from '@/features/component-library'

interface RoomsTabContentProps {
  residenceId: string
}

export const RoomsTabContent = ({ residenceId }: RoomsTabContentProps) => {
  const roomsQuery = useRooms({ residenceId })
  const rooms = roomsQuery.data || []
  const { openRoomId, setOpenRoomId, roomRefs } = useRoomDeepLink(rooms)

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
          {rooms.map((room) => {
            const displayName = getRoomDisplayName(room)

            return (
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
                    <span className="font-medium">{displayName}</span>
                    <span className="text-sm text-muted-foreground">
                      {room.code}
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="border-t bg-muted/30 space-y-4 pt-4">
                  <RoomDetails room={room} />
                  <SpaceComponents
                    spaceId={(room as any).propertyObjectId}
                    spaceName={`Rum: ${displayName}`}
                  />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </TabLayout>
  )
}
