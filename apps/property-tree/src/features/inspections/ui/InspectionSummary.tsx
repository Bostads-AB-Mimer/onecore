import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Badge } from '@/shared/ui/Badge'
import { Input } from '@/shared/ui/Input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

import { CONDITION_TYPE, getConditionConfig } from '../constants/conditions'
import {
  ROOM_COMPONENTS,
  getComponentLabel,
  type ComponentDefinition,
} from '../constants/components'

type InspectionRoom = components['schemas']['InspectionRoom']

interface InspectionSummaryProps {
  inspectionData: Record<string, InspectionRoom>
  rooms: Room[]
}

function getRoomRemarks(
  roomData: InspectionRoom | undefined
): ComponentDefinition[] {
  if (!roomData) return []
  return ROOM_COMPONENTS.filter((component) => {
    const condition = roomData.conditions[component.key]
    return (
      condition === CONDITION_TYPE.ACCEPTABLE ||
      condition === CONDITION_TYPE.DAMAGED
    )
  })
}

export function InspectionSummary({
  inspectionData,
  rooms,
}: InspectionSummaryProps) {
  const roomSections = rooms
    .map((room) => ({
      room,
      roomData: inspectionData[room.id],
      remarks: getRoomRemarks(inspectionData[room.id]),
    }))
    .filter((section) => section.remarks.length > 0)

  const totalRemarks = roomSections.reduce(
    (sum, section) => sum + section.remarks.length,
    0
  )

  const remarksLabel = totalRemarks === 1 ? 'anmärkning' : 'anmärkningar'

  return (
    <div className="space-y-4">
      <header className="border rounded-lg p-4 space-y-1 bg-card">
        <h2 className="text-xl font-semibold">Sammanställning</h2>
        <p className="text-sm text-muted-foreground">
          {totalRemarks} {remarksLabel} i {roomSections.length} rum
        </p>
      </header>

      {roomSections.length === 0 && (
        <div className="p-8 border rounded-lg text-center text-muted-foreground">
          Inga anmärkningar registrerade. Alla komponenter är i gott skick.
        </div>
      )}

      {roomSections.map(({ room, roomData, remarks }) => (
        <section
          key={room.id}
          className="border rounded-lg p-4 space-y-3 bg-card"
        >
          <h3 className="text-base font-semibold">{room.name}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Komponent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Kostnad (kr)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remarks.map((component) => {
                const condition = roomData?.conditions[component.key]
                const conditionConfig = getConditionConfig(condition)

                return (
                  <TableRow key={component.key}>
                    <TableCell className="font-medium">
                      {getComponentLabel(component.key)}
                    </TableCell>
                    <TableCell>
                      {conditionConfig && (
                        <Badge
                          variant={conditionConfig.badgeVariant}
                          className={conditionConfig.badgeClassName}
                        >
                          {conditionConfig.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={0}
                        aria-label={`Kostnad för ${getComponentLabel(component.key)}`}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  )
}
