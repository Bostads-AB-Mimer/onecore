import { SpaceComponents } from '@/features/component-library'
import { RoomsTabContent as RoomList } from '@/features/rooms'

interface RoomsTabContentProps {
  rentalId: string
}

export const RoomsTabContent = ({ rentalId }: RoomsTabContentProps) => (
  <RoomList
    rentalId={rentalId}
    renderRoomComponents={(room, displayName) => (
      <SpaceComponents
        spaceId={room.propertyObjectId}
        spaceName={`Rum: ${displayName}`}
      />
    )}
  />
)
