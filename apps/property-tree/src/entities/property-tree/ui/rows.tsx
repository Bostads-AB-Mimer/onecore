// Presentational row atoms for the picker table. No state, no data fetching.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { paths } from '@/shared/routes'
import { Checkbox } from '@/shared/ui/Checkbox'
import { TableCell, TableRow } from '@/shared/ui/Table'

import type {
  OccupantTenant,
  RentalObjectSummary,
} from '../hooks/useOccupantData'
import { RENTAL_OBJECT_TYPE_LABELS } from '../hooks/useOccupantData'
import { LEVEL_LABELS } from '../model/labels'
import type { CheckState } from '../model/selection'
import type { NodeRowSpec } from '../model/treeRows'
import { LEVEL_ICONS, OBJECT_TYPE_ICONS } from './icons'

export const COLUMN_COUNT = 4

function Indent({ depth, children }: { depth: number; children?: ReactNode }) {
  // Tighter per-level indent when the panel is narrow.
  return (
    <div
      className="flex items-center gap-2 pl-[calc(var(--indent-depth)*12px)] @xl:pl-[calc(var(--indent-depth)*20px)]"
      style={{ '--indent-depth': depth } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

function ExpandChevron({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle?: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle?.()
      }}
      className="p-0.5 text-muted-foreground hover:text-foreground"
      aria-label={expanded ? 'Fäll ihop' : 'Expandera'}
    >
      {expanded ? (
        <ChevronDown className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
    </button>
  )
}

/** Selectable tree node (district / kvv-area / property / building).
 * `excluded` (object-type filter): greyed, forced unchecked, unselectable —
 * but still expandable so its objects remain browsable. */
export function NodeRow({
  row,
  checkState,
  onCheck,
  onToggleExpand,
  excluded = false,
  count,
}: {
  row: NodeRowSpec
  checkState: CheckState
  onCheck: () => void
  onToggleExpand: () => void
  excluded?: boolean
  /** Object count for the currently active object types. */
  count?: number
}) {
  const LevelIcon = LEVEL_ICONS[row.node.level]
  const displayState: CheckState = excluded ? 'unchecked' : checkState
  // Row click expands; checkbox and name select (and stop propagation).
  return (
    <TableRow
      onClick={row.expandable ? onToggleExpand : undefined}
      className={
        row.expandable
          ? 'cursor-pointer transition-colors hover:bg-muted'
          : 'hover:bg-muted'
      }
    >
      <TableCell className="py-2">
        <Indent depth={row.depth}>
          {row.expandable ? (
            <ExpandChevron expanded={row.expanded} onToggle={onToggleExpand} />
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <Checkbox
            checked={
              displayState === 'indeterminate'
                ? 'indeterminate'
                : displayState === 'checked'
            }
            disabled={excluded}
            onCheckedChange={excluded ? undefined : onCheck}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Välj ${row.node.label}`}
          />
          <LevelIcon
            className={
              excluded
                ? 'h-4 w-4 shrink-0 text-muted-foreground opacity-50'
                : 'h-4 w-4 shrink-0 text-muted-foreground'
            }
          />
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (!excluded) onCheck()
              }}
              className={
                excluded
                  ? 'block cursor-default truncate text-left font-medium text-muted-foreground opacity-60'
                  : row.depth === 0
                    ? 'block truncate text-left font-semibold hover:text-primary hover:underline'
                    : 'block truncate text-left font-medium hover:text-primary hover:underline'
              }
            >
              {row.node.label}
            </button>
            <div className="truncate text-xs text-muted-foreground @xl:hidden">
              {row.code}
            </div>
          </div>
        </Indent>
      </TableCell>
      <TableCell className="hidden py-2 text-muted-foreground @3xl:table-cell">
        {row.typeLabel ?? LEVEL_LABELS[row.node.level]}
      </TableCell>
      <TableCell className="hidden py-2 text-muted-foreground @xl:table-cell">
        {row.code}
      </TableCell>
      <TableCell className="hidden py-2 text-right tabular-nums text-muted-foreground @4xl:table-cell">
        {count ?? ''}
      </TableCell>
    </TableRow>
  )
}

/** Expandable view-only group header (trapphus / bilplatser / lokaler).
 * `muted` greys the header when its object type is filtered out. */
export function GroupRow({
  depth,
  label,
  typeLabel,
  code,
  count,
  expanded,
  onToggle,
  muted = false,
}: {
  depth: number
  label: string
  typeLabel?: string
  code?: string
  count?: number
  expanded: boolean
  onToggle: () => void
  muted?: boolean
}) {
  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted"
      onClick={onToggle}
    >
      <TableCell className="py-1.5">
        <Indent depth={depth}>
          <ExpandChevron expanded={expanded} onToggle={onToggle} />
          <div className="min-w-0">
            <span
              className={
                muted
                  ? 'block truncate font-medium text-muted-foreground opacity-60'
                  : 'block truncate font-medium text-muted-foreground'
              }
            >
              {label}
            </span>
            {code && (
              <div className="truncate text-xs text-muted-foreground @xl:hidden">
                {code}
              </div>
            )}
          </div>
        </Indent>
      </TableCell>
      <TableCell className="hidden py-1.5 text-muted-foreground @3xl:table-cell">
        {typeLabel ?? ''}
      </TableCell>
      <TableCell className="hidden py-1.5 text-muted-foreground @xl:table-cell">
        {code ?? ''}
      </TableCell>
      <TableCell className="hidden py-1.5 text-right tabular-nums text-muted-foreground @4xl:table-cell">
        {count ?? ''}
      </TableCell>
    </TableRow>
  )
}

/** Leaf: one rental object shown as its current tenants (like the
 * Hyreskontrakt page) — contact-code link + name per tenant, or Vakant.
 * The checkbox mirrors the parent's selection; toggling it requires
 * `selectable` (enabled by the send flow, not the filter picker). */
export function ObjectRow({
  depth,
  object,
  tenants,
  checkState,
  selectable = false,
  requiresTenants = true,
  onCheck,
  excluded = false,
}: {
  depth: number
  object: RentalObjectSummary
  /** undefined while the tenant lookup is still loading. */
  tenants: OccupantTenant[] | undefined
  checkState: CheckState
  selectable?: boolean
  /** Recipient semantics: a vacant object reaches nobody, so it shows no
   * inherited tick. Off where objects are picked for their own sake. */
  requiresTenants?: boolean
  onCheck?: () => void
  /** Object-type filter: greyed and never ticked. */
  excluded?: boolean
}) {
  const TypeIcon = OBJECT_TYPE_ICONS[object.type]
  const reachable =
    !requiresTenants || (tenants !== undefined && tenants.length > 0)
  const displayState: CheckState =
    reachable && !excluded ? checkState : 'unchecked'
  return (
    <TableRow className={excluded ? 'opacity-60' : undefined}>
      <TableCell className="py-1.5">
        <Indent depth={depth}>
          <span className="w-5 shrink-0" />
          <Checkbox
            checked={
              displayState === 'indeterminate'
                ? 'indeterminate'
                : displayState === 'checked'
            }
            disabled={!selectable || excluded}
            onCheckedChange={selectable && !excluded ? onCheck : undefined}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Välj ${object.rentalId}`}
          />
          <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            {tenants === undefined ? (
              <span className="text-xs text-muted-foreground">Laddar...</span>
            ) : tenants.length === 0 ? (
              <span className="text-muted-foreground">Vakant</span>
            ) : (
              <div className="space-y-0.5">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.contactCode || tenant.name}
                    className="truncate"
                  >
                    {tenant.contactCode && (
                      <>
                        <Link
                          to={paths.tenant(tenant.contactCode)}
                          className="font-medium text-primary hover:underline"
                        >
                          {tenant.contactCode}
                        </Link>{' '}
                      </>
                    )}
                    {tenant.name}
                  </div>
                ))}
              </div>
            )}
            <div className="truncate text-xs text-muted-foreground @xl:hidden">
              {object.rentalId}
            </div>
          </div>
        </Indent>
      </TableCell>
      <TableCell className="hidden py-1.5 text-muted-foreground @3xl:table-cell">
        {object.subtypeName ?? RENTAL_OBJECT_TYPE_LABELS[object.type]}
      </TableCell>
      <TableCell className="hidden py-1.5 text-muted-foreground @xl:table-cell">
        {object.rentalId}
      </TableCell>
      <TableCell className="hidden py-1.5 @4xl:table-cell" />
    </TableRow>
  )
}

export function InfoRow({ depth, label }: { depth: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT} className="py-1.5">
        <Indent depth={depth}>
          <span className="text-xs text-muted-foreground">{label}</span>
        </Indent>
      </TableCell>
    </TableRow>
  )
}
