import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Grid'
import { RoomCard } from './RoomCard'
import { roomService } from '@/services/api'

interface ResidenceRoomsProps {
  residenceId: string
  buildingCode: string
  floorCode: string
}

export function ResidenceRooms({
  residenceId,
  buildingCode,
  floorCode,
}: ResidenceRoomsProps) {
  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms', residenceId],
    queryFn: () =>
      roomService.getByBuildingAndFloorAndResidence(
        buildingCode,
        floorCode,
        residenceId
      ),
  })

  if (isLoading) {
    return (
      <Card title="Rum">
        <Grid cols={2}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
            />
          ))}
        </Grid>
      </Card>
    )
  }

  return (
    <Card title="Rum">
      <Grid cols={2}>
        {rooms?.map((room) => (
          <RoomCard key={room.id} room={room} residenceId={residenceId} />
        ))}
      </Grid>
    </Card>
  )
}
