import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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

import type {
  PropertyTree,
  PropertyTreeRoot,
  TreeGrouping,
} from '../hooks/usePropertyTreeData'
import {
  propertyTreeQuery,
  usePropertyTreeRoots,
  usePropertyTrees,
} from '../hooks/usePropertyTreeData'
import type { GetParentInfo } from '../hooks/useTreeSelectionState'
import type { ObjectFilter, ObjectFilterView } from '../model/facets'
import {
  buildFacetIndex,
  filterSelection,
  filterSignature,
  nodeCount,
  nodeExcluded,
  rowCheckState,
} from '../model/facets'
import { GROUPING_LABELS, rememberNodeLabel } from '../model/labels'
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
  addCoveredAncestorKeys,
  buildTreeRows,
  collectDescendantNodes,
  findParentInfo,
  MAX_EXPANDED_CRITERIA,
  MIN_SEARCH_LENGTH,
  rootKeyOf,
} from '../model/treeRows'
import { ObjectTypeFilterButtonGroup } from './ObjectTypeFilterButtonGroup'
import { ObjectTenantRow } from './OccupantRows'
import { COLUMN_COUNT, InfoRow, NodeRow } from './rows'

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
  onDeselectNodes: (
    nodes: PropertyTreeNode[],
    getParent?: GetParentInfo
  ) => void
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
  // Manual open (true) / close (false) per key; absent = auto-expansion
  // (search hits, expand-all) decides.
  const [expandOverrides, setExpandOverrides] = useState<
    ReadonlyMap<string, boolean>
  >(new Map())
  const [expandAll, setExpandAll] = useState(false)
  const [includeDescendants, setIncludeDescendants] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 200)
  const query = debouncedSearch.trim().toLowerCase()
  const searchActive = query.length >= MIN_SEARCH_LENGTH

  // A search *starting* opens everything: manual closes reset. Refining or
  // backspacing an active search keeps them — folding a hit should stick.
  const searchWasActive = useRef(false)
  useEffect(() => {
    const started = searchActive && !searchWasActive.current
    searchWasActive.current = searchActive
    if (!started) return
    setExpandOverrides((prev) => {
      if (![...prev.values()].some((open) => !open)) return prev
      return new Map([...prev].filter(([, open]) => open))
    })
  }, [query, searchActive])

  const { roots, isLoading: rootsLoading } = usePropertyTreeRoots(grouping)

  // With "inkludera underliggande" on, roots carrying selected nodes must load
  // too. Signature-keyed so more picks under one root don't re-walk the rows.
  // TODO(målgrupp): ancestors[0] is the grouping the node was picked UNDER —
  // after a grouping switch it matches no current root (cf. the facets fix).
  const selectedRootKeySignature = useMemo(() => {
    if (!includeDescendants) return ''
    const keys = new Set<string>()
    for (const node of selection.values()) {
      keys.add(node.ancestors[0] ?? node.key)
    }
    return [...keys].sort().join('|')
  }, [includeDescendants, selection])
  const selectedRootKeys = useMemo(
    () =>
      new Set(
        selectedRootKeySignature ? selectedRootKeySignature.split('|') : []
      ),
    [selectedRootKeySignature]
  )

  // Roots whose data is loaded: all of them while searching or expanded, the
  // opened ones otherwise. Counting and bulk selection cover these; the rest
  // show no counts and are never filtered out.
  const loadedRoots = useMemo(
    () =>
      searchActive || expandAll
        ? roots
        : roots.filter((root) => {
            const key = rootKeyOf(root)
            return (
              expandOverrides.get(key) === true || selectedRootKeys.has(key)
            )
          }),
    [roots, searchActive, expandAll, expandOverrides, selectedRootKeys]
  )
  const treeState = usePropertyTrees(grouping, loadedRoots, open)
  // Withhold search rows until every tree has landed: partial results reorder
  // as slower districts arrive. If cold searches ever feel slow, the deferred
  // fix is groupBy WITHOUT rootId answering all trees in one atomic response.
  const searchSettling = searchActive && treeState.isLoading

  // One value object carries the whole object-level filter and the counts
  // derived from it, so no part of the tree has to know which is which.
  const filter = useMemo<ObjectFilter>(
    () => ({ types: activeObjectTypes, subtypeKeys: activeSubtypes }),
    [activeObjectTypes, activeSubtypes]
  )
  const signature = filterSignature(filter)
  const facets = useMemo(
    () => buildFacetIndex(treeState.walks, filter),
    // filter is covered by its signature; walks are combine-memoised.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [treeState.walks, signature]
  )
  const view = useMemo<ObjectFilterView>(
    () => ({ filter, facets }),
    [filter, facets]
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
  const getParentInfo = useCallback<GetParentInfo>(
    (parentKey) => {
      for (const root of roots) {
        const tree = cachedTree(root)
        if (!tree) continue
        const info = findParentInfo(root, tree, parentKey)
        if (!info) continue
        // A loaded tree carries its object leaves, so child lists are
        // complete. Where objects aren't selectable they only block roll-up,
        // never join it.
        if (selectableObjects) return info
        return {
          node: info.node,
          children: info.children.map((child) =>
            child.level === 'object' ? { ...child, selectable: false } : child
          ),
        }
      }
      return undefined
    },
    [roots, cachedTree, selectableObjects]
  )
  const handleToggleNode = useCallback(
    (node: PropertyTreeNode) => onToggleNode(node, getParentInfo),
    [onToggleNode, getParentInfo]
  )
  const handleSelectNodes = useCallback(
    (nodes: PropertyTreeNode[]) => onSelectNodes(nodes, getParentInfo),
    [onSelectNodes, getParentInfo]
  )
  // Same resolver as the single-node path: clearing the rows a search has
  // narrowed to must not take their unshown siblings with them.
  const handleDeselectNodes = useCallback(
    (nodes: PropertyTreeNode[]) => onDeselectNodes(nodes, getParentInfo),
    [onDeselectNodes, getParentInfo]
  )

  // Indeterminate keys, from the walks on screen (see addCoveredAncestorKeys);
  // keys found in no loaded walk fall back to their stored ancestors.
  const coveredKeys = useMemo(() => {
    const out = new Set<string>()
    const resolved = new Set<string>()
    for (const root of roots) {
      const { tree } = treeState.stateOf(root.id)
      if (!tree) continue
      addCoveredAncestorKeys(root, tree, selection, out, resolved)
    }
    for (const node of selection.values()) {
      if (resolved.has(node.key)) continue
      for (const ancestor of node.ancestors) out.add(ancestor)
    }
    return out
  }, [roots, treeState, selection])

  /**
   * Every row on screen, in order — the table and the header checkbox read
   * this one walk. Built over every root, not just the loaded ones: a
   * collapsed root is still a visible, selectable row.
   *
   * The selection is deliberately not an input: were it one, every checkbox
   * click would re-walk the whole loaded forest, object leaves included.
   */
  const rows = useMemo(
    () =>
      roots.flatMap((root) => {
        const { tree, isLoading } = treeState.stateOf(root.id)
        return buildTreeRows(root, tree, {
          query,
          overrides: expandOverrides,
          loading: isLoading,
          expandAllStructure: expandAll,
        })
      }),
    [roots, treeState, query, expandOverrides, expandAll]
  )

  /** Keys of every branch currently open. Read off the rows rather than walked
   * for: collapse-all folds exactly what is on screen, including branches
   * search auto-opened and ones the user opened by hand. Only collapse-all
   * during a search reads it, so it isn't built otherwise. */
  const openKeys = useMemo(
    () =>
      searchActive
        ? rows
            .filter((r): r is NodeRowSpec => r.kind === 'node' && r.expanded)
            .map((r) => r.node.key)
        : [],
    [rows, searchActive]
  )

  /**
   * The selectable nodes the header checkbox acts on. While searching that
   * means the matches themselves, not the ancestor rows carrying them:
   * checking a district because one of its buildings matched would select the
   * whole district. Nodes the filter empties are shown but never bulk-selected.
   */
  const visibleNodes = useMemo(
    () =>
      rows
        .filter(
          (r): r is NodeRowSpec =>
            r.kind === 'node' && (!searchActive || !!r.matched)
        )
        .map((r) => r.node)
        .filter((n) => n.selectable !== false && !nodeExcluded(n, view)),
    [rows, searchActive, view]
  )

  // Header checkbox state. Memoised together: both scan every visible node,
  // and neither changes except when the selection or the rows do.
  const { allVisibleSelected, someVisibleSelected } = useMemo(() => {
    const all =
      visibleNodes.length > 0 &&
      visibleNodes.every(
        (n) => nodeCheckState(selection, n, coveredKeys) === 'checked'
      )
    return {
      allVisibleSelected: all,
      someVisibleSelected:
        !all &&
        visibleNodes.some(
          (n) => nodeCheckState(selection, n, coveredKeys) !== 'unchecked'
        ),
    }
  }, [visibleNodes, selection, coveredKeys])

  // Latently-selected nodes excluded by the type filter are not applied (nor
  // counted) but stay in the selection so re-enabling the type restores them.
  const effectiveSelection = useMemo(
    () => filterSelection(selection, view),
    [selection, view]
  )

  // "Inkludera underliggande nivåer": every descendant tree node under each
  // selected node, type-filter-pruned. `unresolved` while a needed tree is
  // missing — loadedRoots fetches it, so applying waits instead of no-oping.
  const { expandedDescendants, unresolvedDescendants } = useMemo(() => {
    if (!includeDescendants)
      return {
        expandedDescendants: [] as PropertyTreeNode[],
        unresolvedDescendants: false,
      }
    const seen = new Set<string>()
    const out: PropertyTreeNode[] = []
    let unresolved = false
    for (const node of effectiveSelection.values()) {
      // Leaves have nothing beneath them; roots of the other grouping can
      // never resolve in this one.
      if (
        node.level === 'staircase' ||
        node.level === 'parkingArea' ||
        node.level === 'object'
      )
        continue
      if (node.level === 'marketArea' && grouping !== 'marketArea') continue
      if (
        (node.level === 'district' || node.level === 'kvvArea') &&
        grouping !== 'costCenter'
      )
        continue
      let found = false
      for (const root of roots) {
        const { tree } = treeState.stateOf(root.id)
        if (!tree) continue
        const descendants = collectDescendantNodes(root, tree, node.key, (n) =>
          nodeExcluded(n, view)
        )
        if (!descendants) continue
        found = true
        for (const d of descendants) {
          if (!seen.has(d.key) && !effectiveSelection.has(d.key)) {
            seen.add(d.key)
            out.push(d)
          }
        }
        break
      }
      if (!found) unresolved = true
    }
    return { expandedDescendants: out, unresolvedDescendants: unresolved }
  }, [includeDescendants, grouping, roots, treeState, effectiveSelection, view])

  // Only while something is in flight: a node no loaded tree can resolve
  // (e.g. picked under the other grouping) shouldn't block applying forever.
  const descendantsPending = unresolvedDescendants && treeState.isLoading

  const totalCriteria = effectiveSelection.size + expandedDescendants.length
  const overCap = includeDescendants && totalCriteria > MAX_EXPANDED_CRITERIA

  // A callback, not a memo: in 'button' mode nothing reads this until the user
  // clicks, so there is no reason to rebuild it on every filter change.
  const applyPayload = useCallback((): [
    PropertyTreeNode[],
    PropertyTreeFilters,
  ] => {
    const nodes = new Map<string, PropertyTreeNode>()
    for (const node of effectiveSelection.values()) nodes.set(node.key, node)
    for (const node of expandedDescendants) nodes.set(node.key, node)
    return [
      [...nodes.values()],
      {
        // [] means no restriction — all types are active.
        objectTypes: isTypeFilterActive(activeObjectTypes)
          ? ALL_RENTAL_OBJECT_TYPES.filter((t) => activeObjectTypes.has(t))
          : [],
        // Sorted for the same reason selectionToScopes sorts: this array lands
        // in a react-query key, and tick order must not split the cache.
        subtypes: [...activeSubtypes].sort(),
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

  // Both refs are declared before emitApply reads them: it is only ever called
  // from a click or an effect today, but a future caller during render would
  // hit the temporal dead zone, and neither TS nor eslint would catch it.
  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply
  const applyPayloadRef = useRef(applyPayload)
  applyPayloadRef.current = applyPayload

  /** Applying is also when the picker teaches the label cache what a stored
   * criterion value is called. Kept out of applyPayload, which several things
   * call: the labels should be recorded when an apply happens, not whenever
   * the payload is built. */
  const emitApply = useCallback(() => {
    const [nodes, filters] = applyPayloadRef.current()
    for (const node of nodes) {
      rememberNodeLabel(node.level, node.value, node.label)
    }
    onApplyRef.current(nodes, filters)
  }, [])

  /**
   * Live mode has no apply button: every check and every filter click is the
   * apply. Keyed on what the payload *contains* rather than on its identity —
   * counts arriving re-derive the selection, and firing on that would re-apply
   * on renders instead of on changes.
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
  // The mount-time emit with nothing selected is a no-op for every consumer —
  // skipping it keeps a remount from wiping what the page already applied.
  const selectionEmpty =
    effectiveSelection.size === 0 && expandedDescendants.length === 0
  const hasEmittedRef = useRef(false)
  useEffect(() => {
    if (applyMode !== 'live' || overCap || descendantsPending) return
    if (selectionEmpty && !hasEmittedRef.current) return
    hasEmittedRef.current = true
    emitApply()
    // emitApply reads both refs; applySignature is the real dependency.
  }, [
    applyMode,
    overCap,
    descendantsPending,
    applySignature,
    selectionEmpty,
    emitApply,
  ])

  // An explicit override either way, so folding a search hit sticks even
  // though auto-expansion would reopen it.
  const handleToggleExpand = useCallback(
    (key: string, currentlyExpanded: boolean) => {
      setExpandOverrides((prev) => new Map(prev).set(key, !currentlyExpanded))
    },
    []
  )

  if (!open) return null

  const dropCloses = (prev: ReadonlyMap<string, boolean>) =>
    new Map([...prev].filter(([, open]) => open))

  const anyExpanded = searchActive
    ? openKeys.length > 0
    : expandAll || [...expandOverrides.values()].some(Boolean)
  const handleExpandCollapseAll = () => {
    // Search mode: fold/restore the auto-opened matches via overrides.
    if (searchActive) {
      if (anyExpanded) {
        setExpandAll(false)
        setExpandOverrides((prev) => {
          const next = new Map(prev)
          for (const key of openKeys) next.set(key, false)
          return next
        })
      } else {
        setExpandOverrides(dropCloses)
      }
      return
    }
    if (anyExpanded) {
      setExpandAll(false)
      setExpandOverrides(new Map())
    } else {
      setExpandAll(true)
      setExpandOverrides(dropCloses)
    }
  }

  // Header checkbox: covers every visible node, or clears them again.

  const handleToggleAllVisible = () => {
    if (allVisibleSelected) {
      handleDeselectNodes(visibleNodes)
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
              {GROUPING_LABELS[g]}
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
        <ObjectTypeFilterButtonGroup
          activeObjectTypes={activeObjectTypes}
          onToggleObjectType={onToggleObjectType}
          activeSubtypes={activeSubtypes}
          onToggleSubtype={onToggleSubtype}
        />
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
                    aria-pressed={anyExpanded}
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
            ) : searchSettling ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-4 text-center text-muted-foreground"
                >
                  Söker...
                </TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((row) =>
                  row.kind === 'object' ? (
                    <ObjectTenantRow
                      key={row.node.key}
                      row={row}
                      checkState={nodeCheckState(
                        selection,
                        row.node,
                        coveredKeys
                      )}
                      excluded={nodeExcluded(row.node, view)}
                      selectableObjects={selectableObjects}
                      onToggleObject={handleToggleNode}
                    />
                  ) : (
                    <Fragment key={row.node.key}>
                      <NodeRow
                        row={row}
                        checkState={rowCheckState(
                          selection,
                          row.node,
                          view,
                          coveredKeys
                        )}
                        onCheck={handleToggleNode}
                        onToggleExpand={handleToggleExpand}
                        excluded={nodeExcluded(row.node, view)}
                        count={nodeCount(row.node, view)}
                      />
                      {row.loading && (
                        <InfoRow depth={row.depth + 1} label="Laddar..." />
                      )}
                    </Fragment>
                  )
                )}
                {searchActive && rows.length === 0 && (
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
              {descendantsPending
                ? 'Laddar underliggande...'
                : `+${expandedDescendants.length} underliggande`}
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
              onClick={emitApply}
              disabled={
                effectiveSelection.size === 0 || overCap || descendantsPending
              }
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
