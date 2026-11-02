import { SpaceComponents } from '@/features/component-library'
import { RoomsTabContent as RoomList } from '@/features/rooms'

interface RoomsTabContentProps {
  facilityId: string
}

export const RoomsTabContent = ({ facilityId }: RoomsTabContentProps) => (
  <RoomList
    facilityId={facilityId}
    renderRoomComponents={(room, displayName) => (
      <SpaceComponents
        spaceId={room.propertyObjectId}
        spaceName={`Rum: ${displayName}`}
      />
    )}
  />
)
