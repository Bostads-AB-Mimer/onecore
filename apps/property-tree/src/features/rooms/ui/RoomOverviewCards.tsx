import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { useIsMobile } from '@/shared/hooks/useMobile'
import { getOrientationText } from '../lib/getRoomOrientation'
import type { components } from '@/services/api/core/generated/api-types'

type Room = components['schemas']['Room']

interface RoomOverviewCardsProps {
  rooms: Room[]
}

export const RoomOverviewCards = ({ rooms }: RoomOverviewCardsProps) => {
  const isMobile = useIsMobile()

  return (
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
          </div>
        </CardContent>
      </Card>

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
    </div>
  )
}
