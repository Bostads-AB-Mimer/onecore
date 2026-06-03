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
  COST_RESPONSIBILITY,
  type CostResponsibility,
} from '../constants/costResponsibility'
import { CostResponsibilitySelect } from './CostResponsibilitySelect'

type InspectionRoom = components['schemas']['InspectionRoom']

interface Remark {
  key: string
  label: string
  condition: string
  componentId: string
  rawLabel?: string
  // Distinguishes detail-component remarks (added in DetailComponentsSection)
  // from fetched-component remarks. Drives which update handler the row uses
  // and which collection in roomData to look up cost/responsibility from.
  source: 'component' | 'detail'
}

function isReportable(condition: string | undefined): boolean {
  return (
    condition === CONDITION_TYPE.ACCEPTABLE ||
    condition === CONDITION_TYPE.DAMAGED
  )
}

function getComponentRemarks(roomData: InspectionRoom | undefined): Remark[] {
  if (!roomData) return []
  const componentRemarks: Remark[] = (roomData.components ?? [])
    .filter((c) => isReportable(c.condition))
    .map((c) => ({
      key: `component-${c.componentId}`,
      // Label is snapshotted at write-time (see InspectionComponent.label) so
      // renames or deletions in property-base don't break old summaries.
      label: c.label || c.componentId,
      rawLabel: c.label,
      componentId: c.componentId,
      condition: c.condition,
      source: 'component',
    }))
  const detailRemarks: Remark[] = (roomData.detailComponents ?? [])
    .filter((d) => isReportable(d.condition))
    .map((d) => ({
      key: `detail-${d.id}`,
      label: d.label || d.id,
      rawLabel: d.label,
      componentId: d.id,
      condition: d.condition ?? '',
      source: 'detail',
    }))
  return [...componentRemarks, ...detailRemarks]
}

function CostInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (cost: number) => void
  ariaLabel: string
}) {
  return (
    <Input
      type="number"
      min={0}
      step={1}
      // Render 0 as an empty field so the placeholder shows and the user can
      // type from scratch without fighting a sticky "0" from the controlled
      // value.
      value={value === 0 ? '' : value}
      placeholder="0"
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value
        const cost = raw === '' ? 0 : Math.max(0, Math.trunc(Number(raw) || 0))
        onChange(cost)
      }}
      aria-label={ariaLabel}
    />
  )
}

interface RoomSectionProps {
  room: Room
  roomData: InspectionRoom | undefined
  onComponentCostByIdUpdate: (
    roomId: string,
    componentId: string,
    label: string,
    cost: number
  ) => void
  onComponentCostResponsibilityByIdUpdate: (
    roomId: string,
    componentId: string,
    label: string,
    value: CostResponsibility
  ) => void
  onDetailComponentCostUpdate: (
    roomId: string,
    componentId: string,
    cost: number
  ) => void
  onDetailComponentCostResponsibilityUpdate: (
    roomId: string,
    componentId: string,
    value: CostResponsibility
  ) => void
}

function RoomSummarySection({
  room,
  roomData,
  onComponentCostByIdUpdate,
  onComponentCostResponsibilityByIdUpdate,
  onDetailComponentCostUpdate,
  onDetailComponentCostResponsibilityUpdate,
}: RoomSectionProps) {
  const remarks = getComponentRemarks(roomData)

  if (remarks.length === 0) return null

  // Compute the per-row presentation once so the mobile card layout and the
  // desktop table can share the same conditional rules without diverging.
  const rows = remarks.map((remark) => {
    const conditionConfig = getConditionConfig(remark.condition)
    let costValue: number
    let costResponsibility: CostResponsibility
    if (remark.source === 'detail') {
      const detail = roomData?.detailComponents?.find(
        (d) => d.id === remark.componentId
      )
      costValue = detail?.cost ?? 0
      costResponsibility = detail?.costResponsibility ?? null
    } else {
      const component = roomData?.components?.find(
        (c) => c.componentId === remark.componentId
      )
      costValue = component?.cost ?? 0
      costResponsibility = component?.costResponsibility ?? null
    }
    // Cost responsibility only applies to Skadad — Ok rows are informational
    // and show no cost/responsibility inputs.
    const showResponsibility = remark.condition === CONDITION_TYPE.DAMAGED
    // When the landlord (Hyresvärd) bears the cost, the inspector doesn't
    // enter a kr amount.
    const showCost =
      showResponsibility && costResponsibility !== COST_RESPONSIBILITY.LANDLORD
    const handleCostChange = (cost: number) => {
      if (remark.source === 'detail') {
        onDetailComponentCostUpdate(room.id, remark.componentId, cost)
      } else {
        onComponentCostByIdUpdate(
          room.id,
          remark.componentId,
          remark.rawLabel ?? remark.label,
          cost
        )
      }
    }
    const handleResponsibilityChange = (value: CostResponsibility) => {
      if (remark.source === 'detail') {
        onDetailComponentCostResponsibilityUpdate(
          room.id,
          remark.componentId,
          value
        )
      } else {
        onComponentCostResponsibilityByIdUpdate(
          room.id,
          remark.componentId,
          remark.rawLabel ?? remark.label,
          value
        )
      }
    }
    return {
      remark,
      conditionConfig,
      costValue,
      costResponsibility,
      showResponsibility,
      showCost,
      handleCostChange,
      handleResponsibilityChange,
    }
  })

  return (
    <section className="border rounded-lg p-4 space-y-3 bg-card">
      <h3 className="text-base font-semibold">{room.name}</h3>

      {/* Mobile: stacked cards. The 4-column table doesn't fit on a phone, so
          each remark renders as a self-contained block instead. */}
      <div className="sm:hidden space-y-3">
        {rows.map(
          ({
            remark,
            conditionConfig,
            costValue,
            costResponsibility,
            showResponsibility,
            showCost,
            handleCostChange,
            handleResponsibilityChange,
          }) => (
            <div
              key={remark.key}
              className="border rounded-md p-3 space-y-3 bg-background"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{remark.label}</span>
                {conditionConfig && (
                  <Badge
                    variant={conditionConfig.badgeVariant}
                    className={conditionConfig.badgeClassName}
                  >
                    {conditionConfig.label}
                  </Badge>
                )}
              </div>
              {showCost && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Kostnad (kr)
                  </label>
                  <CostInput
                    value={costValue}
                    onChange={handleCostChange}
                    ariaLabel={`Kostnad för ${remark.label}`}
                  />
                </div>
              )}
              {showResponsibility && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Kostnadsansvar
                  </label>
                  <CostResponsibilitySelect
                    value={costResponsibility}
                    onChange={handleResponsibilityChange}
                    ariaLabel={`Kostnadsansvar för ${remark.label}`}
                  />
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Desktop: full table with all four columns. */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Komponent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40">Kostnad (kr)</TableHead>
              <TableHead className="w-44">Kostnadsansvar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(
              ({
                remark,
                conditionConfig,
                costValue,
                costResponsibility,
                showResponsibility,
                showCost,
                handleCostChange,
                handleResponsibilityChange,
              }) => (
                <TableRow key={remark.key}>
                  <TableCell className="font-medium">{remark.label}</TableCell>
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
                    {showCost && (
                      <CostInput
                        value={costValue}
                        onChange={handleCostChange}
                        ariaLabel={`Kostnad för ${remark.label}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {showResponsibility && (
                      <CostResponsibilitySelect
                        value={costResponsibility}
                        onChange={handleResponsibilityChange}
                        ariaLabel={`Kostnadsansvar för ${remark.label}`}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

interface InspectionSummaryProps {
  inspectionData: Record<string, InspectionRoom>
  rooms: Room[]
  onComponentCostByIdUpdate: (
    roomId: string,
    componentId: string,
    label: string,
    cost: number
  ) => void
  onComponentCostResponsibilityByIdUpdate: (
    roomId: string,
    componentId: string,
    label: string,
    value: CostResponsibility
  ) => void
  onDetailComponentCostUpdate: (
    roomId: string,
    componentId: string,
    cost: number
  ) => void
  onDetailComponentCostResponsibilityUpdate: (
    roomId: string,
    componentId: string,
    value: CostResponsibility
  ) => void
}

export function InspectionSummary({
  inspectionData,
  rooms,
  onComponentCostByIdUpdate,
  onComponentCostResponsibilityByIdUpdate,
  onDetailComponentCostUpdate,
  onDetailComponentCostResponsibilityUpdate,
}: InspectionSummaryProps) {
  const perRoom = rooms.map((room) => {
    const roomData = inspectionData[room.id]
    const componentCount = (roomData?.components ?? []).filter((c) =>
      isReportable(c.condition)
    ).length
    const detailCount = (roomData?.detailComponents ?? []).filter((d) =>
      isReportable(d.condition)
    ).length
    return { room, roomData, total: componentCount + detailCount }
  })

  const roomsWithRemarks = perRoom.filter((r) => r.total > 0)
  const totalRemarks = roomsWithRemarks.reduce((sum, r) => sum + r.total, 0)
  const remarksLabel = totalRemarks === 1 ? 'anmärkning' : 'anmärkningar'

  return (
    <div className="space-y-4">
      <header className="border rounded-lg p-4 space-y-1 bg-card">
        <h2 className="text-xl font-semibold">Sammanställning</h2>
        <p className="text-sm text-muted-foreground">
          {totalRemarks} {remarksLabel} i {roomsWithRemarks.length} rum
        </p>
      </header>

      {totalRemarks === 0 && (
        <div className="p-8 border rounded-lg text-center text-muted-foreground">
          Inga anmärkningar registrerade. Alla komponenter är i gott skick.
        </div>
      )}

      {roomsWithRemarks.map(({ room, roomData }) => (
        <RoomSummarySection
          key={room.id}
          room={room}
          roomData={roomData}
          onComponentCostByIdUpdate={onComponentCostByIdUpdate}
          onComponentCostResponsibilityByIdUpdate={
            onComponentCostResponsibilityByIdUpdate
          }
          onDetailComponentCostUpdate={onDetailComponentCostUpdate}
          onDetailComponentCostResponsibilityUpdate={
            onDetailComponentCostResponsibilityUpdate
          }
        />
      ))}
    </div>
  )
}
