import type { components } from '@/services/api/core/generated/api-types'

import { getOrientationText } from '../lib/getRoomOrientation'

type Room = components['schemas']['Room']

interface RoomDetailsProps {
  room: Room
}

export const RoomDetails = ({ room }: RoomDetailsProps) => {
  const features = [
    room.features.isHeated && 'Uppvärmt',
    room.features.hasThermostatValve && 'Termostatventil',
    room.features.hasToilet && 'Toalett',
    room.usage.shared && 'Delat utrymme',
  ].filter(Boolean)

  const fields = [
    { label: 'Typ', value: room.roomType?.name || '-' },
    {
      label: 'Orientering',
      value: getOrientationText(room.features.orientation),
    },
    {
      label: 'Egenskaper',
      value: features.length > 0 ? features.join(', ') : 'Inga',
    },
    {
      label: 'Periodiskt arbete',
      value: room.usage.allowPeriodicWorks ? 'Tillåtet' : 'Ej tillåtet',
    },
  ]

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
      {fields.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
