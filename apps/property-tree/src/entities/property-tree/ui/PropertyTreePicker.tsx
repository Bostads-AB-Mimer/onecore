import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  X,
} from 'lucide-react'

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

import { useObjectFacets } from '../hooks/useObjectFacets'
import { RENTAL_OBJECT_GROUP_LABELS } from '../hooks/useOccupantData'
import type {
  PropertyTree,
  PropertyTreeRoot,
  TreeGrouping,
} from '../hooks/usePropertyTreeData'
import {
  propertyTreeQuery,
  usePropertyTree,
  usePropertyTreeRoots,
  usePropertyTrees,
} from '../hooks/usePropertyTreeData'
import {
  subtypeKey,
  useRentalObjectSubtypes,
} from '../hooks/useRentalObjectSubtypes'
import type { GetParentInfo } from '../hooks/useTreeSelectionState'
import type {
  ObjectFilter,
  ObjectFilterView,
  RentalObject,
} from '../model/facets'
import {
  filterSelection,
  nodeCount,
  nodeExcluded,
  nodePartiallyExcluded,
  objectNode,
  objectParentKey,
} from '../model/facets'
import { rememberNodeLabel } from '../model/labels'
import type {
  PropertyTreeNode,
  PropertyTreeSelection,
  RentalObjectType,
} from '../model/selection'
import {
  ALL_RENTAL_OBJECT_TYPES,
  isTypeFilterActive,
  nodeCheckState,
} from '../model/selection'
import type { NodeRowSpec } from '../model/treeRows'
import {
  buildTreeRows,
  collectDescendantNodes,
  findParentInfo,
  MAX_EXPANDED_CRITERIA,
  MIN_SEARCH_LENGTH,
  rootKeyOf,
} from '../model/treeRows'
import { OBJECT_TYPE_ICONS } from './icons'
import { ObjectTenantRow } from './OccupantRows'
import { COLUMN_COUNT, InfoRow, NodeRow } from './rows'

function DistrictRows({
  root,
  query,
  selection,
  view,
  expanded,
  collapsed,
  expandAll,
  onToggleExpand,
  onToggleNode,
  selectableObjects,
  objectsByParent,
}: {
  root: PropertyTreeRoot
  query: string
  selection: PropertyTreeSelection
  view: ObjectFilterView
  expanded: ReadonlySet<string>
  collapsed: ReadonlySet<string>
  expandAll: boolean
  onToggleExpand: (key: string, currentlyExpanded: boolean) => void
  onToggleNode: (node: PropertyTreeNode) => void
  selectableObjects: boolean
  objectsByParent: ReadonlyMap<string, RentalObject[]>
}) {
  const searchActive = query.length >= MIN_SEARCH_LENGTH
  const shouldLoad = searchActive || expandAll || expanded.has(rootKeyOf(root))
  const { data: tree, isLoading } = usePropertyTree(
    root.grouping,
    shouldLoad ? root.id : undefined
  )

  // Memoised because the selection is NOT an input here: without this, every
  // checkbox click re-walks the whole loaded tree, object leaves included.
  const rows = useMemo(
    () =>
      buildTreeRows(
        root,
        tree,
        isLoading,
        query,
        expanded,
        collapsed,
        expandAll,
        objectsByParent
      ),
    [
      root,
      tree,
      isLoading,
      query,
      expanded,
      collapsed,
      expandAll,
      objectsByParent,
    ]
  )
  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => {
        if (row.kind === 'object') {
          return (
            <ObjectTenantRow
              key={row.node.key}
              row={row}
              selection={selection}
              view={view}
              selectableObjects={selectableObjects}
              onToggleObject={onToggleNode}
            />
          )
        }
        // A selected node with a mix of active and excluded objects shows
        // indeterminate — "checked" would claim its greyed members too.
        const rawState = nodeCheckState(selection, row.node)
        const checkState =
          rawState === 'checked' && nodePartiallyExcluded(row.node, view)
            ? 'indeterminate'
            : rawState
        return (
          <Fragment key={row.node.key}>
            <NodeRow
              row={row}
              checkState={checkState}
              onCheck={() => onToggleNode(row.node)}
              onToggleExpand={() => onToggleExpand(row.node.key, row.expanded)}
              excluded={nodeExcluded(row.node, view)}
              count={nodeCount(row.node, view)}
            />
            {row.loading && <InfoRow depth={row.depth + 1} label="Laddar..." />}
          </Fragment>
        )
      })}
    </>
  )
}

/** The picker's object filters at apply time. Both restrictions default to []
 * (no restriction); subtypes are `type:code` keys. The grouping rides along so
 * consumers can resolve the selected nodes back to their roots. */
export interface PropertyTreeFilters {
  objectTypes: RentalObjectType[]
  subtypes: string[]
  grouping: TreeGrouping
}

interface PropertyTreePickerProps {
  open: boolean
  /** Omitted where the picker is always on the page — no close affordances. */
  onClose?: () => void
  /** The checked nodes, plus the active object filters ([] = no restriction).
   * Consumers map these to whatever they need — audience criteria, an object
   * list, recipients. The picker itself stays domain-agnostic. */
  onApply: (nodes: PropertyTreeNode[], filters: PropertyTreeFilters) => void
  /** Which groupings the switcher offers. Defaults to both. */
  groupings?: TreeGrouping[]
  /** Heading and lead text — the picker is used for more than målgrupper. */
  title?: string
  description?: string
  /** 'live' applies on every change (no button); 'button' waits for one. */
  applyMode?: 'live' | 'button'
  /** The "inkludera underliggande nivåer" expansion only makes sense where
   * criteria are stored per level, so consumers opt in. */
  showIncludeDescendants?: boolean
  /** Inline on a page rather than a panel: no card chrome, no close button. */
  variant?: 'card' | 'plain'
  /** Lets individual rental objects be ticked, not just mirror their parent.
   * Off by default: in the målgrupp flow a leaf is a recipient list, and a
   * vakant object reaches nobody. */
  selectableObjects?: boolean
  /** Page-owned selection (see useTreeSelectionState). */
  selection: PropertyTreeSelection
  onToggleNode: (node: PropertyTreeNode, getParent?: GetParentInfo) => void
  /** Bulk-select ("select all search matches"). */
  onSelectNodes: (nodes: PropertyTreeNode[], getParent?: GetParentInfo) => void
  /** Bulk-uncheck. Its own callback rather than N onToggleNode calls, which
   * would re-select descendants as their ancestors are cleared. */
  onDeselectNodes: (nodes: PropertyTreeNode[]) => void
  /** Page-owned object-type filter (all four = no restriction). */
  activeObjectTypes: ReadonlySet<RentalObjectType>
  onToggleObjectType: (type: RentalObjectType) => void
  /** Selected subtypes as `type:code` keys; empty = no subtype restriction.
   * Subtypes narrow object rows only — there are far too many to precompute
   * per tree node, so they cannot grey branches the way types do. */
  activeSubtypes: ReadonlySet<string>
  onToggleSubtype: (key: string) => void
}

const DEFAULT_GROUPINGS: TreeGrouping[] = ['costCenter', 'marketArea']

/**
 * Inline picker for choosing parts of the property hierarchy. The selection is
 * owned by the consumer and survives apply and close/open; it is never
 * re-hydrated from stored state — removing a chip prunes it instead.
 */
export function PropertyTreePicker({
  open,
  onClose,
  onApply,
  groupings = DEFAULT_GROUPINGS,
  title = 'Välj målgrupp',
  description = 'Kryssa i på den nivå du vill nå — urvalet sparas exakt där. Expandera en byggnad eller ett parkeringsområde för att se hyresobjekt och hyresgäster.',
  applyMode = 'button',
  showIncludeDescendants = true,
  variant = 'card',
  selectableObjects = false,
  selection,
  onToggleNode,
  onSelectNodes,
  onDeselectNodes,
  activeObjectTypes,
  onToggleObjectType,
  activeSubtypes,
  onToggleSubtype,
}: PropertyTreePickerProps) {
  const [grouping, setGrouping] = useState<TreeGrouping>(groupings[0])
  const [subtypeMenu, setSubtypeMenu] = useState<RentalObjectType | null>(null)
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

  // Object rows carry a subtype caption, not a code, so the selected
  // `type:code` keys are resolved to names for filtering.
  const { byType: subtypesByType, nameByKey } = useRentalObjectSubtypes()
  const activeSubtypeNames = useMemo(() => {
    const out = new Set<string>()
    for (const key of activeSubtypes) {
      const name = nameByKey.get(key)
      if (name) out.add(name)
    }
    return out
  }, [activeSubtypes, nameByKey])

  const { roots, isLoading: rootsLoading } = usePropertyTreeRoots(grouping)

  // Roots whose data is loaded: all of them while searching or expanded, the
  // opened ones otherwise. Counting and bulk selection cover these; the rest
  // keep the tree's own per-type counts.
  const loadedRoots = useMemo(
    () =>
      searchActive || expandAll
        ? roots
        : roots.filter((root) => expanded.has(rootKeyOf(root))),
    [roots, searchActive, expandAll, expanded]
  )
  const trees = usePropertyTrees(grouping, loadedRoots, open)
  const searchLoading = trees.some((t) => t.isLoading)

  // One value object carries the whole object-level filter and the counts
  // derived from it, so no part of the tree has to know which is which.
  const filter = useMemo<ObjectFilter>(
    () => ({ types: activeObjectTypes, subtypeKeys: activeSubtypes }),
    [activeObjectTypes, activeSubtypes]
  )
  const { facets, objects } = useObjectFacets(
    grouping,
    loadedRoots,
    open,
    filter
  )
  const view = useMemo<ObjectFilterView>(
    () => ({ filter, facets, subtypeNames: activeSubtypeNames }),
    [filter, facets, activeSubtypeNames]
  )

  // Lazy parent resolver for selection roll-up: looks the parent up in
  // whichever trees are already cached — a parent whose tree isn't loaded
  // can't have had a child checked, so cache misses are safe.
  const queryClient = useQueryClient()
  const cachedTree = useCallback(
    (root: PropertyTreeRoot) =>
      queryClient.getQueryData<PropertyTree>(
        // The query's own key, not a copy: a reader spelling it by hand would
        // silently miss if the fetchers ever changed it.
        propertyTreeQuery(grouping, root.id).queryKey
      ),
    [queryClient, grouping]
  )
  // Objects grouped by the node they hang under, so a trapphus or
  // parkeringsområde can answer for its objects the way a property answers
  // for its buildings.
  const objectsByParent = useMemo(() => {
    const byParent = new Map<string, RentalObject[]>()
    for (const object of objects) {
      const parentKey = objectParentKey(object)
      if (!parentKey) continue
      const list = byParent.get(parentKey) ?? []
      list.push(object)
      byParent.set(parentKey, list)
    }
    return byParent
  }, [objects])

  const getParentInfo = useCallback<GetParentInfo>(
    (parentKey) => {
      for (const root of roots) {
        const tree = cachedTree(root)
        if (!tree) continue
        const info = findParentInfo(root, tree, parentKey)
        if (!info) continue
        // Structure children plus any objects drawn directly under this node:
        // a building rolls up only when its trapphus AND its loose objects
        // are all checked.
        const own = objectsByParent.get(parentKey)
        if (!own?.length) return info
        return {
          node: info.node,
          children: [
            ...info.children,
            ...own.map((object) => objectNode(object, info.node)),
          ],
        }
      }
      return undefined
    },
    [roots, cachedTree, objectsByParent]
  )
  const handleToggleNode = useCallback(
    (node: PropertyTreeNode) => onToggleNode(node, getParentInfo),
    [onToggleNode, getParentInfo]
  )
  const handleSelectNodes = useCallback(
    (nodes: PropertyTreeNode[]) => onSelectNodes(nodes, getParentInfo),
    [onSelectNodes, getParentInfo]
  )

  /**
   * The selectable nodes on screen right now — what the header checkbox acts
   * on. While searching that means the matches themselves, not the ancestor
   * rows carrying them: checking a district because one of its buildings
   * matched would select the whole district. Nodes the filter empties are
   * shown but never bulk-selected.
   */
  const treeByRootId = useMemo(() => {
    const byId = new Map<string, PropertyTree | undefined>()
    loadedRoots.forEach((root, i) => byId.set(root.id, trees[i]?.data))
    return byId
  }, [loadedRoots, trees])

  const visibleNodes = useMemo(() => {
    const noExpansion = new Set<string>()
    // Every root, not just the loaded ones: a collapsed root is still a
    // visible, selectable row, and selecting it covers its whole subtree.
    return roots.flatMap((root) =>
      buildTreeRows(
        root,
        treeByRootId.get(root.id),
        false,
        query,
        searchActive ? noExpansion : expanded,
        collapsed,
        !searchActive && expandAll,
        objectsByParent
      )
        .filter(
          (r): r is NodeRowSpec =>
            r.kind === 'node' && (!searchActive || !!r.matched)
        )
        .map((r) => r.node)
        .filter((n) => n.selectable !== false && !nodeExcluded(n, view))
    )
  }, [
    roots,
    treeByRootId,
    query,
    searchActive,
    expanded,
    collapsed,
    expandAll,
    view,
    objectsByParent,
  ])

  // Latently-selected nodes excluded by the type filter are not applied (nor
  // counted) but stay in the selection so re-enabling the type restores them.
  const effectiveSelection = useMemo(
    () => filterSelection(selection, view),
    [selection, view]
  )

  // "Inkludera underliggande nivåer": every descendant tree node under each
  // selected node, type-filter-pruned, resolved from cached district trees.
  const expandedDescendants = useMemo(() => {
    if (!includeDescendants) return []
    const seen = new Set<string>()
    const out: PropertyTreeNode[] = []
    for (const node of effectiveSelection.values()) {
      // Trapphus/parkeringsområden are leaves — nothing beneath them.
      if (node.level === 'staircase' || node.level === 'parkingArea') continue
      for (const root of roots) {
        const tree = cachedTree(root)
        if (!tree) continue
        const descendants = collectDescendantNodes(root, tree, node.key, (n) =>
          nodeExcluded(n, view)
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
  }, [includeDescendants, roots, effectiveSelection, view, cachedTree])

  const totalCriteria = effectiveSelection.size + expandedDescendants.length
  const overCap = includeDescendants && totalCriteria > MAX_EXPANDED_CRITERIA

  // Keys of every branch currently open in search mode (auto-opened matches
  // minus manual overrides) — collapse-all folds exactly these.
  const searchOpenKeys = useMemo(() => {
    if (!searchActive) return []
    return roots.flatMap((root) =>
      buildTreeRows(
        root,
        treeByRootId.get(root.id),
        false,
        query,
        expanded,
        collapsed,
        false
      )
        .filter((r): r is NodeRowSpec => r.kind === 'node' && r.expanded)
        .map((r) => r.node.key)
    )
  }, [searchActive, roots, treeByRootId, query, expanded, collapsed])

  const applyPayload = useCallback((): [
    PropertyTreeNode[],
    PropertyTreeFilters,
  ] => {
    const nodes = new Map<string, PropertyTreeNode>()
    for (const node of effectiveSelection.values()) nodes.set(node.key, node)
    for (const node of expandedDescendants) nodes.set(node.key, node)
    for (const node of nodes.values()) {
      rememberNodeLabel(node.level, node.value, node.label)
    }
    return [
      [...nodes.values()],
      {
        // [] means no restriction — all types are active.
        objectTypes: isTypeFilterActive(activeObjectTypes)
          ? ALL_RENTAL_OBJECT_TYPES.filter((t) => activeObjectTypes.has(t))
          : [],
        subtypes: [...activeSubtypes],
        grouping,
      },
    ]
  }, [
    effectiveSelection,
    expandedDescendants,
    activeObjectTypes,
    activeSubtypes,
    grouping,
  ])

  const handleApply = () => onApply(...applyPayload())

  /**
   * Live mode has no apply button: every check and every filter click is the
   * apply. Keyed on what the payload *contains* rather than on the callback's
   * identity — counts arriving re-derive the selection object, and firing on
   * that would re-apply on renders instead of on changes.
   */
  const applySignature = useMemo(
    () =>
      [
        grouping,
        [...effectiveSelection.keys()].sort().join(','),
        [...activeObjectTypes].sort().join(','),
        [...activeSubtypes].sort().join(','),
        expandedDescendants
          .map((n) => n.key)
          .sort()
          .join(','),
      ].join('|'),
    [
      grouping,
      effectiveSelection,
      activeObjectTypes,
      activeSubtypes,
      expandedDescendants,
    ]
  )
  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply
  const applyPayloadRef = useRef(applyPayload)
  applyPayloadRef.current = applyPayload
  useEffect(() => {
    if (applyMode !== 'live' || overCap) return
    onApplyRef.current(...applyPayloadRef.current())
    // Both refs are stable; applySignature is the real dependency.
  }, [applyMode, overCap, applySignature])

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

  /** Subtype checkboxes for one object type, anchored under the type strip.
   * Hand-rolled rather than shared/ui/Popover: Radix anchors to the trigger,
   * and the trigger here is a 14px chevron, so the panel lands off-centre. */
  const renderSubtypeMenu = (type: RentalObjectType) => {
    const options = subtypesByType.get(type) ?? []
    const chosenKeys = options
      .map((s) => subtypeKey(type, s.code))
      .filter((key) => activeSubtypes.has(key))
    return (
      <>
        {/* Click-away layer; the popover sits above it. */}
        <div
          className="fixed inset-0 z-10"
          onClick={() => setSubtypeMenu(null)}
        />
        <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border bg-background p-1 shadow-md">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs text-muted-foreground">
              {RENTAL_OBJECT_GROUP_LABELS[type]}:{' '}
              {chosenKeys.length === 0
                ? 'alla typer'
                : `${chosenKeys.length} av ${options.length}`}
            </span>
            {chosenKeys.length > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => chosenKeys.forEach(onToggleSubtype)}
              >
                Rensa
              </button>
            )}
          </div>
          {options.map((s) => {
            const key = subtypeKey(type, s.code)
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={activeSubtypes.has(key)}
                  onCheckedChange={() => onToggleSubtype(key)}
                />
                <span className="truncate">{s.name}</span>
              </label>
            )
          })}
        </div>
      </>
    )
  }

  // Header checkbox: covers every visible node, or clears them again.
  const allVisibleSelected =
    visibleNodes.length > 0 &&
    visibleNodes.every((n) => nodeCheckState(selection, n) === 'checked')
  const someVisibleSelected =
    !allVisibleSelected &&
    visibleNodes.some((n) => nodeCheckState(selection, n) !== 'unchecked')

  const handleToggleAllVisible = () => {
    if (allVisibleSelected) {
      onDeselectNodes(visibleNodes)
      return
    }
    handleSelectNodes(visibleNodes)
  }

  const Shell = variant === 'card' ? Card : 'div'
  return (
    <Shell className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Stäng väljaren"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {groupings.length > 1 && (
        <div className="inline-flex divide-x overflow-hidden rounded-md border">
          {groupings.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrouping(g)}
              aria-pressed={g === grouping}
              className={
                g === grouping
                  ? 'bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                  : 'bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted'
              }
            >
              {g === 'costCenter' ? 'Distrikt' : 'Marknadsområde'}
            </button>
          ))}
        </div>
      )}

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
        {/* The subtype popover is a sibling of the button strip, not a child:
            the strip clips its overflow to keep the rounded corners. */}
        <div className="relative">
          <div className="inline-flex divide-x overflow-hidden rounded-md border">
            {ALL_RENTAL_OBJECT_TYPES.map((type) => {
              const TypeIcon = OBJECT_TYPE_ICONS[type]
              const active = activeObjectTypes.has(type)
              const options = subtypesByType.get(type) ?? []
              const chosen = options.filter((s) =>
                activeSubtypes.has(subtypeKey(type, s.code))
              ).length
              return (
                <div key={type} className="inline-flex">
                  <button
                    type="button"
                    onClick={() => onToggleObjectType(type)}
                    aria-pressed={active}
                    title={RENTAL_OBJECT_GROUP_LABELS[type]}
                    className={
                      active
                        ? 'inline-flex items-center gap-1.5 bg-primary py-1.5 pl-3 pr-2 text-sm font-medium text-primary-foreground transition-colors'
                        : 'inline-flex items-center gap-1.5 bg-background py-1.5 pl-3 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted'
                    }
                  >
                    <TypeIcon className="h-4 w-4" />
                    <span className="hidden @2xl:inline">
                      {RENTAL_OBJECT_GROUP_LABELS[type]}
                    </span>
                    {chosen > 0 && (
                      <span className="rounded-full bg-background/25 px-1.5 text-xs">
                        {chosen}
                      </span>
                    )}
                  </button>
                  {active && options.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSubtypeMenu((current) =>
                          current === type ? null : type
                        )
                      }
                      aria-label={`Välj ${RENTAL_OBJECT_GROUP_LABELS[
                        type
                      ].toLowerCase()}typ`}
                      className={
                        active
                          ? 'bg-primary pr-2 text-primary-foreground'
                          : 'bg-background pr-2 text-muted-foreground'
                      }
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {subtypeMenu && renderSubtypeMenu(subtypeMenu)}
        </div>
      </div>

      <div className="@container rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[42%]">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={
                      allVisibleSelected
                        ? true
                        : someVisibleSelected
                          ? 'indeterminate'
                          : false
                    }
                    disabled={visibleNodes.length === 0}
                    onCheckedChange={handleToggleAllVisible}
                    aria-label={
                      allVisibleSelected
                        ? 'Avmarkera allt som visas'
                        : `Markera allt som visas (${visibleNodes.length})`
                    }
                  />
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
            {rootsLoading ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-8 text-center text-muted-foreground"
                >
                  Laddar...
                </TableCell>
              </TableRow>
            ) : (
              <>
                {roots.map((root) => (
                  <DistrictRows
                    key={root.id}
                    root={root}
                    query={query}
                    selection={selection}
                    view={view}
                    expanded={expanded}
                    collapsed={collapsed}
                    expandAll={expandAll}
                    onToggleExpand={handleToggleExpand}
                    onToggleNode={handleToggleNode}
                    selectableObjects={selectableObjects}
                    objectsByParent={objectsByParent}
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
                  visibleNodes.length === 0 && (
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
          {showIncludeDescendants && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeDescendants}
                onCheckedChange={() => setIncludeDescendants((v) => !v)}
              />
              Inkludera underliggande nivåer
            </label>
          )}
          {includeDescendants && !overCap && (
            <span className="text-sm text-muted-foreground">
              +{expandedDescendants.length} underliggande
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Stäng
            </Button>
          )}
          {applyMode === 'button' && (
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
          )}
        </div>
      </div>
    </Shell>
  )
}
