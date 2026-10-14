import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import {
  componentNeedsAttention,
  useComponentsBySpace,
} from '@/entities/component'

import type { components } from '@/services/api/core/generated/api-types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { cn } from '@/shared/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'
import { badgeVariants } from '@/shared/ui/Badge'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { useRoomDeepLink } from '../hooks/useRoomDeepLink'
import { useRooms } from '../hooks/useRooms'
import { getRoomDisplayName } from '../lib/getRoomDisplayName'
import { RoomDetails } from './RoomDetails'

type Room = components['schemas']['Room']

type RoomsTabContentProps = (
  | { rentalId: string; facilityId?: never }
  | { rentalId?: never; facilityId: string }
) & {
  renderRoomComponents: (room: Room, displayName: string) => ReactNode
}

const byDisplayOrder = (a: Room, b: Room) =>
  Number(a.deleted) - Number(b.deleted) || a.sortingOrder - b.sortingOrder

export const RoomsTabContent = ({
  rentalId,
  facilityId,
  renderRoomComponents,
}: RoomsTabContentProps) => {
  const isMobile = useIsMobile()
  const roomsQuery = useRooms(
    rentalId ? { rentalId } : { facilityId: facilityId! }
  )
  const rooms = [...(roomsQuery.data ?? [])].sort(byDisplayOrder)
  const { openRoomId, setOpenRoomId, roomRefs } = useRoomDeepLink(rooms)
  const componentsBySpace = useComponentsBySpace(
    rooms.filter((room) => !room.deleted).map((room) => room.propertyObjectId)
  )

  return (
    <TabLayout
      title="Rum"
      showCard={!isMobile}
      count={
        roomsQuery.isLoading || roomsQuery.error ? undefined : rooms.length
      }
      isLoading={roomsQuery.isLoading}
      error={roomsQuery.error as Error | null}
      errorMessage="Kunde inte hämta rummen. Ladda om sidan för att försöka igen."
    >
      {rooms.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Inga rum registrerade
        </p>
      ) : (
        <Accordion
          type="single"
          collapsible
          className="space-y-2"
          value={openRoomId}
          onValueChange={setOpenRoomId}
        >
          {rooms.map((room) => {
            const displayName = getRoomDisplayName(room)
            const roomComponents = componentsBySpace.get(room.propertyObjectId)
            const attentionCount =
              roomComponents?.filter(componentNeedsAttention).length ?? 0

            return (
              <AccordionItem
                key={room.id}
                value={room.id}
                ref={(el) => {
                  if (el) roomRefs.current.set(room.id, el)
                }}
                className="scroll-mt-4 rounded-lg border bg-card"
              >
                <AccordionTrigger className="gap-3 rounded-lg px-3 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4">
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-left">
                    <span
                      className={
                        room.deleted ? 'text-muted-foreground' : undefined
                      }
                    >
                      {displayName}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      <span className="sr-only">, rumskod </span>
                      {room.code}
                    </span>
                    {room.deleted && (
                      <span
                        className={cn(
                          badgeVariants({ variant: 'outline' }),
                          'border-transparent bg-muted px-2.5 text-muted-foreground'
                        )}
                      >
                        Borttaget
                      </span>
                    )}
                  </span>
                  {roomComponents && (
                    <span className="flex shrink-0 flex-col items-end text-sm font-normal sm:flex-row sm:items-center sm:gap-3">
                      <span className="sr-only">, </span>
                      {attentionCount > 0 && (
                        <span className="flex items-center gap-1 text-warning">
                          <AlertTriangle
                            className="h-4 w-4 shrink-0"
                            aria-hidden
                          />
                          {attentionCount} behöver åtgärd
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {roomComponents.length}{' '}
                        {roomComponents.length === 1
                          ? 'komponent'
                          : 'komponenter'}
                      </span>
                    </span>
                  )}
                </AccordionTrigger>

                <AccordionContent className="space-y-5 border-t px-3 pt-4 sm:px-4">
                  <RoomDetails room={room} />
                  {renderRoomComponents(room, displayName)}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </TabLayout>
  )
}
