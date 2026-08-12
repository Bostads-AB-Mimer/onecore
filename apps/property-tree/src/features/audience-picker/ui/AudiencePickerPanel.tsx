import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronsDownUp, ChevronsUpDown, Search, X } from 'lucide-react'

import { useDebounce } from '@/shared/hooks/useDebounce'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

import type { GetParentInfo } from '../hooks/useAudienceSelectionState'
import type {
  CostCenterSummary,
  CostCenterTree,
} from '../hooks/useAudienceTreeData'
import {
  useAudienceDistricts,
  useAudienceDistrictTree,
  useAudienceDistrictTrees,
} from '../hooks/useAudienceTreeData'
import { RENTAL_OBJECT_GROUP_LABELS } from '../hooks/useOccupantData'
import type { NodeRowSpec } from '../model/districtRows'
import {
  buildDistrictRows,
  collectDescendantNodes,
  findParentInfo,
  MAX_EXPANDED_CRITERIA,
  MIN_SEARCH_LENGTH,
} from '../model/districtRows'
import { rememberAudienceLabel } from '../model/labels'
import type {
  AudienceCriteriaValues,
  AudienceNode,
  AudienceObjectType,
  AudienceSelection,
} from '../model/selection'
import {
  ALL_AUDIENCE_OBJECT_TYPES,
  filterSelectionForTypes,
  isTypeFilterActive,
  nodeCheckState,
  nodeExcludedByTypes,
  nodeKey,
  nodePartiallyExcludedByTypes,
  selectionToCriteria,
} from '../model/selection'
import { OBJECT_TYPE_ICONS } from './icons'
import {
  BuildingExtraRows,
  ParkingAreaOccupantRows,
  PropertyExtraRows,
  StaircaseOccupantRows,
} from './OccupantRows'
import { COLUMN_COUNT, InfoRow, NodeRow } from './rows'

function DistrictRows({
  district,
  query,
  selection,
  activeTypes,
  expanded,
  collapsed,
  expandAll,
  onToggleExpand,
  onToggleNode,
}: {
  district: CostCenterSummary
  query: string
  selection: AudienceSelection
  activeTypes: ReadonlySet<AudienceObjectType>
  expanded: ReadonlySet<string>
  collapsed: ReadonlySet<string>
  expandAll: boolean
  onToggleExpand: (key: string, currentlyExpanded: boolean) => void
  onToggleNode: (node: AudienceNode) => void
}) {
  const searchActive = query.length >= MIN_SEARCH_LENGTH
  const districtKey = nodeKey('district', district.code)
  const shouldLoad = searchActive || expandAll || expanded.has(districtKey)
  const { data: tree, isLoading } = useAudienceDistrictTree(
    shouldLoad ? district.id : undefined
  )

  const rows = buildDistrictRows(
    district,
    tree,
    isLoading,
    query,
    expanded,
    collapsed,
    expandAll
  )
  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => {
        if (row.kind === 'propertyExtras') {
          return (
            <PropertyExtraRows
              key={row.key}
              spec={row}
              selection={selection}
              activeTypes={activeTypes}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          )
        }
        if (row.kind === 'buildingExtras') {
          return (
            <BuildingExtraRows
              key={row.key}
              spec={row}
              selection={selection}
              activeTypes={activeTypes}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          )
        }
        // A selected node with a mix of active and excluded objects shows
        // indeterminate — "checked" would claim its greyed members too.
        const rawState = nodeCheckState(selection, row.node)
        const checkState =
          rawState === 'checked' &&
          nodePartiallyExcludedByTypes(row.node, activeTypes)
            ? 'indeterminate'
            : rawState
        return (
          <Fragment key={row.node.key}>
            <NodeRow
              row={row}
              checkState={checkState}
              onCheck={() => onToggleNode(row.node)}
              onToggleExpand={() => onToggleExpand(row.node.key, row.expanded)}
              excluded={nodeExcludedByTypes(row.node, activeTypes)}
            />
            {row.loading && <InfoRow depth={row.depth + 1} label="Laddar..." />}
            {row.node.level === 'staircase' && row.expanded && (
              <StaircaseOccupantRows
                row={row}
                depth={row.depth + 1}
                selection={selection}
                activeTypes={activeTypes}
              />
            )}
            {row.node.level === 'parkingArea' &&
              row.expanded &&
              row.propertyCode &&
              row.propertyDesignation && (
                <ParkingAreaOccupantRows
                  parkingAreaNode={row.node}
                  propertyCode={row.propertyCode}
                  propertyDesignation={row.propertyDesignation}
                  depth={row.depth + 1}
                  selection={selection}
                  activeTypes={activeTypes}
                />
              )}
          </Fragment>
        )
      })}
    </>
  )
}

interface AudiencePickerPanelProps {
  open: boolean
  onClose: () => void
  /** Called with the criteria for the checked levels when the user applies. */
  onApply: (criteria: AudienceCriteriaValues) => void
  /** Page-owned selection (see useAudienceSelectionState). */
  selection: AudienceSelection
  onToggleNode: (node: AudienceNode, getParent?: GetParentInfo) => void
  /** Bulk-select ("select all search matches"). */
  onSelectNodes: (nodes: AudienceNode[], getParent?: GetParentInfo) => void
  /** Page-owned object-type filter (all four = no restriction). */
  activeObjectTypes: ReadonlySet<AudienceObjectType>
  onToggleObjectType: (type: AudienceObjectType) => void
}

/**
 * Inline audience picker rendered below the filter bar, so the other filters
 * stay usable while building an audience. The selection is owned by the page
 * and survives apply and close/open; it is never re-hydrated from stored
 * criteria (MIM-1938) — chip removal prunes it instead.
 */
export function AudiencePickerPanel({
  open,
  onClose,
  onApply,
  selection,
  onToggleNode,
  onSelectNodes,
  activeObjectTypes,
  onToggleObjectType,
}: AudiencePickerPanelProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  // Manual collapses that override auto-expansion (search / expand-all).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [expandAll, setExpandAll] = useState(false)
  const [includeDescendants, setIncludeDescendants] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 200)
  const query = debouncedSearch.trim().toLowerCase()
  const searchActive = query.length >= MIN_SEARCH_LENGTH

  // A new search always starts fully auto-opened.
  useEffect(() => setCollapsed(new Set()), [query])

  const { data: districts, isLoading: districtsLoading } =
    useAudienceDistricts()
  const trees = useAudienceDistrictTrees(
    districts,
    open && (searchActive || expandAll)
  )
  const searchLoading = trees.some((t) => t.isLoading)

  // Lazy parent resolver for selection roll-up: looks the parent up in
  // whichever district trees are already cached — a parent whose tree isn't
  // loaded can't have had a child checked, so cache misses are safe.
  const queryClient = useQueryClient()
  const getParentInfo = useCallback<GetParentInfo>(
    (parentKey) => {
      for (const district of districts ?? []) {
        const tree = queryClient.getQueryData<CostCenterTree>([
          'costCenterTree',
          district.id,
        ])
        if (!tree) continue
        const info = findParentInfo(district, tree, parentKey)
        if (info) return info
      }
      return undefined
    },
    [districts, queryClient]
  )
  const handleToggleNode = useCallback(
    (node: AudienceNode) => onToggleNode(node, getParentInfo),
    [onToggleNode, getParentInfo]
  )
  const handleSelectNodes = useCallback(
    (nodes: AudienceNode[]) => onSelectNodes(nodes, getParentInfo),
    [onSelectNodes, getParentInfo]
  )

  // Every node the search matched, straight from the flagged rows — drives
  // both the visibility and the payload of "Välj alla träffar". Nodes fully
  // excluded by the type filter are shown but not bulk-selectable.
  const searchTargets = useMemo(() => {
    if (!searchActive || !districts) return []
    const noExpansion = new Set<string>()
    return districts.flatMap((district, i) =>
      buildDistrictRows(district, trees[i]?.data, false, query, noExpansion)
        .filter((r): r is NodeRowSpec => r.kind === 'node' && !!r.matched)
        .map((r) => r.node)
        .filter((n) => !nodeExcludedByTypes(n, activeObjectTypes))
    )
  }, [searchActive, districts, trees, query, activeObjectTypes])

  // Latently-selected nodes excluded by the type filter are not applied (nor
  // counted) but stay in the selection so re-enabling the type restores them.
  const effectiveSelection = useMemo(
    () => filterSelectionForTypes(selection, activeObjectTypes),
    [selection, activeObjectTypes]
  )

  // "Inkludera underliggande nivåer": every descendant tree node under each
  // selected node, type-filter-pruned, resolved from cached district trees.
  const expandedDescendants = useMemo(() => {
    if (!includeDescendants || !districts) return []
    const seen = new Set<string>()
    const out: AudienceNode[] = []
    for (const node of effectiveSelection.values()) {
      // Trapphus/parkeringsområden are leaves — nothing beneath them.
      if (node.level === 'staircase' || node.level === 'parkingArea') continue
      for (const district of districts) {
        const tree = queryClient.getQueryData<CostCenterTree>([
          'costCenterTree',
          district.id,
        ])
        if (!tree) continue
        const descendants = collectDescendantNodes(
          district,
          tree,
          node.key,
          activeObjectTypes
        )
        if (!descendants) continue
        for (const d of descendants) {
          if (!seen.has(d.key) && !effectiveSelection.has(d.key)) {
            seen.add(d.key)
            out.push(d)
          }
        }
        break
      }
    }
    return out
  }, [
    includeDescendants,
    districts,
    effectiveSelection,
    activeObjectTypes,
    queryClient,
  ])

  const totalCriteria = effectiveSelection.size + expandedDescendants.length
  const overCap = includeDescendants && totalCriteria > MAX_EXPANDED_CRITERIA

  // Keys of every branch currently open in search mode (auto-opened matches
  // minus manual overrides) — collapse-all folds exactly these.
  const searchOpenKeys = useMemo(() => {
    if (!searchActive || !districts) return []
    return districts.flatMap((district, i) =>
      buildDistrictRows(
        district,
        trees[i]?.data,
        false,
        query,
        expanded,
        collapsed,
        false
      )
        .filter((r): r is NodeRowSpec => r.kind === 'node' && r.expanded)
        .map((r) => r.node.key)
    )
  }, [searchActive, districts, trees, query, expanded, collapsed])

  if (!open) return null

  const handleToggleExpand = (key: string, currentlyExpanded: boolean) => {
    if (currentlyExpanded) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      // Also beats auto-expansion, so search hits can be folded away.
      setCollapsed((prev) => new Set(prev).add(key))
    } else {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      setExpanded((prev) => new Set(prev).add(key))
    }
  }

  const anyExpanded = searchActive
    ? searchOpenKeys.length > 0
    : expandAll || expanded.size > 0
  const handleExpandCollapseAll = () => {
    // Search mode: fold/restore the auto-opened matches via the override set.
    if (searchActive) {
      if (anyExpanded) {
        setCollapsed((prev) => {
          const next = new Set(prev)
          for (const key of searchOpenKeys) next.add(key)
          return next
        })
      } else {
        setCollapsed(new Set())
      }
      return
    }
    if (anyExpanded) {
      setExpandAll(false)
      setExpanded(new Set())
    } else {
      setExpandAll(true)
    }
    setCollapsed(new Set())
  }

  const handleApply = () => {
    const nodes = new Map<string, AudienceNode>()
    for (const node of effectiveSelection.values()) nodes.set(node.key, node)
    for (const node of expandedDescendants) nodes.set(node.key, node)
    for (const node of nodes.values()) {
      rememberAudienceLabel(node.level, node.value, node.label)
    }
    onApply({
      ...selectionToCriteria(nodes),
      objectTypes: isTypeFilterActive(activeObjectTypes)
        ? ALL_AUDIENCE_OBJECT_TYPES.filter((t) => activeObjectTypes.has(t))
        : [],
    })
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Välj målgrupp</h3>
          <p className="text-sm text-muted-foreground">
            Kryssa i distrikt, KVV-områden, fastigheter, byggnader,
            parkeringsområden eller trapphus — urvalet sparas på den nivå du
            kryssar i. Expandera en byggnad eller ett parkeringsområde för att
            se hyresobjekt och hyresgäster.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Stäng målgruppsväljaren"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Sök distrikt, område, fastighet eller adress..."
            className="pl-10"
          />
        </div>
        <div className="inline-flex divide-x overflow-hidden rounded-md border">
          {ALL_AUDIENCE_OBJECT_TYPES.map((type) => {
            const TypeIcon = OBJECT_TYPE_ICONS[type]
            const active = activeObjectTypes.has(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => onToggleObjectType(type)}
                aria-pressed={active}
                title={RENTAL_OBJECT_GROUP_LABELS[type]}
                className={
                  active
                    ? 'inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors'
                    : 'inline-flex items-center gap-1.5 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted'
                }
              >
                <TypeIcon className="h-4 w-4" />
                <span className="hidden @2xl:inline">
                  {RENTAL_OBJECT_GROUP_LABELS[type]}
                </span>
              </button>
            )
          })}
        </div>
        {searchTargets.length > 0 && (
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => handleSelectNodes(searchTargets)}
          >
            Välj alla träffar ({searchTargets.length})
          </Button>
        )}
      </div>

      <div className="@container rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[42%]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExpandCollapseAll}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                    title={anyExpanded ? 'Fäll ihop alla' : 'Expandera alla'}
                    aria-label={
                      anyExpanded ? 'Fäll ihop alla' : 'Expandera alla'
                    }
                  >
                    {anyExpanded ? (
                      <ChevronsDownUp className="h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="h-4 w-4" />
                    )}
                  </button>
                  Namn
                </div>
              </TableHead>
              <TableHead className="hidden w-[24%] @3xl:table-cell">
                Typ
              </TableHead>
              <TableHead className="hidden w-[24%] @xl:table-cell">
                Kod
              </TableHead>
              <TableHead className="hidden w-[10%] text-right @4xl:table-cell">
                Antal
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {districtsLoading ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-8 text-center text-muted-foreground"
                >
                  Laddar distrikt...
                </TableCell>
              </TableRow>
            ) : (
              <>
                {(districts ?? []).map((district) => (
                  <DistrictRows
                    key={district.id}
                    district={district}
                    query={query}
                    selection={selection}
                    activeTypes={activeObjectTypes}
                    expanded={expanded}
                    collapsed={collapsed}
                    expandAll={expandAll}
                    onToggleExpand={handleToggleExpand}
                    onToggleNode={handleToggleNode}
                  />
                ))}
                {searchActive && searchLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="py-4 text-center text-muted-foreground"
                    >
                      Söker...
                    </TableCell>
                  </TableRow>
                )}
                {searchActive &&
                  !searchLoading &&
                  searchTargets.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={COLUMN_COUNT}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Inga träffar
                      </TableCell>
                    </TableRow>
                  )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {overCap && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          För många underliggande kriterier: {totalCriteria} av max{' '}
          {MAX_EXPANDED_CRITERIA}. Filtret kan inte läggas till — välj färre
          noder eller kryssa i på en lägre nivå.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm text-muted-foreground">
            {effectiveSelection.size} valda
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={includeDescendants}
              onCheckedChange={() => setIncludeDescendants((v) => !v)}
            />
            Inkludera underliggande nivåer
          </label>
          {includeDescendants && !overCap && (
            <span className="text-sm text-muted-foreground">
              +{expandedDescendants.length} underliggande
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Stäng
          </Button>
          <Button
            onClick={handleApply}
            disabled={effectiveSelection.size === 0 || overCap}
            title={
              overCap
                ? `Max ${MAX_EXPANDED_CRITERIA} kriterier — minska urvalet`
                : undefined
            }
          >
            Lägg till i filter
          </Button>
        </div>
      </div>
    </Card>
  )
}
