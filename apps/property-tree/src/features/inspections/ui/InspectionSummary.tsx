import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Badge } from '@/shared/ui/Badge'
import { Input } from '@/shared/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
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
  COST_RESPONSIBILITY_LABEL,
  type CostResponsibility,
} from '../constants/costResponsibility'

type InspectionRoom = components['schemas']['InspectionRoom']

// Sentinel used in the <Select> since shadcn's SelectItem disallows empty values.
// Parsed back to `null` before reaching the handler.
const UNSET = '__unset__'

interface Remark {
  key: string
  label: string
  condition: string
  componentId: string
  rawLabel?: string
}

function isReportable(condition: string | undefined): boolean {
  return (
    condition === CONDITION_TYPE.ACCEPTABLE ||
    condition === CONDITION_TYPE.DAMAGED
  )
}

function getComponentRemarks(roomData: InspectionRoom | undefined): Remark[] {
  if (!roomData?.components?.length) return []
  return roomData.components
    .filter((c) => isReportable(c.condition))
    .map((c) => ({
      key: `component-${c.componentId}`,
      // Label is snapshotted at write-time (see InspectionComponent.label) so
      // renames or deletions in property-base don't break old summaries.
      label: c.label || c.componentId,
      rawLabel: c.label,
      componentId: c.componentId,
      condition: c.condition,
    }))
}

function CostResponsibilitySelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: CostResponsibility
  onChange: (value: CostResponsibility) => void
  ariaLabel: string
}) {
  return (
    <Select
      value={value ?? UNSET}
      onValueChange={(v) =>
        onChange(v === UNSET ? null : (v as Exclude<CostResponsibility, null>))
      }
    >
      <SelectTrigger className="h-9" aria-label={ariaLabel}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>—</SelectItem>
        <SelectItem value={COST_RESPONSIBILITY.TENANT}>
          {COST_RESPONSIBILITY_LABEL[COST_RESPONSIBILITY.TENANT]}
        </SelectItem>
        <SelectItem value={COST_RESPONSIBILITY.LANDLORD}>
          {COST_RESPONSIBILITY_LABEL[COST_RESPONSIBILITY.LANDLORD]}
        </SelectItem>
      </SelectContent>
    </Select>
  )
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
}

function RoomSummarySection({
  room,
  roomData,
  onComponentCostByIdUpdate,
  onComponentCostResponsibilityByIdUpdate,
}: RoomSectionProps) {
  const remarks = getComponentRemarks(roomData)

  if (remarks.length === 0) return null

  // Compute the per-row presentation once so the mobile card layout and the
  // desktop table can share the same conditional rules without diverging.
  const rows = remarks.map((remark) => {
    const conditionConfig = getConditionConfig(remark.condition)
    const component = roomData?.components?.find(
      (c) => c.componentId === remark.componentId
    )
    const costValue = component?.cost ?? 0
    const costResponsibility = component?.costResponsibility ?? null
    // Cost responsibility only applies to Skadad — Ok rows are informational
    // and show no cost/responsibility inputs.
    const showResponsibility = remark.condition === CONDITION_TYPE.DAMAGED
    // When the landlord (Hyresvärd) bears the cost, the inspector doesn't
    // enter a kr amount.
    const showCost =
      showResponsibility && costResponsibility !== COST_RESPONSIBILITY.LANDLORD
    const handleCostChange = (cost: number) =>
      onComponentCostByIdUpdate(
        room.id,
        remark.componentId,
        remark.rawLabel ?? remark.label,
        cost
      )
    const handleResponsibilityChange = (value: CostResponsibility) =>
      onComponentCostResponsibilityByIdUpdate(
        room.id,
        remark.componentId,
        remark.rawLabel ?? remark.label,
        value
      )
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
}

export function InspectionSummary({
  inspectionData,
  rooms,
  onComponentCostByIdUpdate,
  onComponentCostResponsibilityByIdUpdate,
}: InspectionSummaryProps) {
  const perRoom = rooms.map((room) => {
    const roomData = inspectionData[room.id]
    const totalCount = (roomData?.components ?? []).filter((c) =>
      isReportable(c.condition)
    ).length
    return { room, roomData, total: totalCount }
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
        />
      ))}
    </div>
  )
}
