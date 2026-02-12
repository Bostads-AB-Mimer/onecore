import { useIsMobile } from '@/shared/hooks/useMobile'
import { getOrientationText } from '../lib/getRoomOrientation'
import type { components } from '@/services/api/core/generated/api-types'

type Room = components['schemas']['Room']

interface RoomDetailsProps {
  room: Room
}

export const RoomDetails = ({ room }: RoomDetailsProps) => {
  const isMobile = useIsMobile()

  return (
    <>
      <div
        className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4`}
      >
        <div>
          <p className="text-sm text-muted-foreground">Typ</p>
          <p className="font-medium">{room.roomType?.name || '-'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Orientering</p>
          <p className="font-medium">
            {getOrientationText(room.features.orientation)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="font-medium">{room.deleted ? 'Borttagen' : 'Aktiv'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Delat utrymme</p>
          <p className="font-medium">{room.usage.shared ? 'Ja' : 'Nej'}</p>
        </div>
      </div>

      <div
        className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4`}
      >
        <div>
          <p className="text-sm text-muted-foreground">Uppvärmd</p>
          <p className="font-medium">{room.features.isHeated ? 'Ja' : 'Nej'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Termostatventil</p>
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
          <p className="text-sm text-muted-foreground">Periodiskt arbete</p>
          <p className="font-medium">
            {room.usage.allowPeriodicWorks ? 'Tillåtet' : 'Ej tillåtet'}
          </p>
        </div>
      </div>
    </>
  )
}
