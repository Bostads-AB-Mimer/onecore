import { useMemo, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'

import type {
  PropertyTreeFilters,
  PropertyTreeNode,
  RentalObjectType,
} from '@/entities/property-tree'
import {
  ALL_RENTAL_OBJECT_TYPES,
  LEVEL_LABELS,
  PropertyTreePicker,
  RENTAL_OBJECT_TYPE_LABELS,
  useRentalObjectSubtypes,
  useTreeSelectionState,
} from '@/entities/property-tree'

import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'
import { Pagination } from '@/shared/ui/Pagination'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

import { useRentalObjectDetails } from '../hooks/useRentalObjectDetails'
import {
  RENTAL_OBJECT_PAGE_SIZE,
  useRentalObjectSearch,
} from '../hooks/useRentalObjectSearch'
import { selectionToScopes } from '../model/scopes'
import { BASE_COLUMNS, OPTIONAL_COLUMNS } from './columns'

const NO_FILTERS: PropertyTreeFilters = {
  objectTypes: [],
  subtypes: [],
  grouping: 'costCenter',
}

type RentalObject = ReturnType<typeof useRentalObjectSearch>['objects'][number]

/**
 * Object-level search: the same hierarchy picker used for målgrupper, but the
 * selection scopes a paginated object list instead of dispatch criteria.
 * Applying replaces the scope (the picker's selection is the whole query),
 * which is why nothing here unions with what was applied before.
 */
export function RentalObjectSearch() {
  const selectionState = useTreeSelectionState()
  const [appliedNodes, setAppliedNodes] = useState<PropertyTreeNode[]>([])
  const [appliedFilters, setAppliedFilters] =
    useState<PropertyTreeFilters>(NO_FILTERS)
  const [activeObjectTypes, setActiveObjectTypes] = useState<
    ReadonlySet<RentalObjectType>
  >(() => new Set(ALL_RENTAL_OBJECT_TYPES))
  const [activeSubtypes, setActiveSubtypes] = useState<ReadonlySet<string>>(
    new Set()
  )
  const [page, setPage] = useState(1)

  const [extraColumns, setExtraColumns] = useState<ReadonlySet<string>>(
    new Set()
  )

  const { nameByKey: subtypeNames } = useRentalObjectSubtypes()
  const scopes = useMemo(() => selectionToScopes(appliedNodes), [appliedNodes])

  const search = useRentalObjectSearch({
    scopes,
    types: appliedFilters.objectTypes,
    subtypes: appliedFilters.subtypes,
    page,
  })

  // Details for just the rows on this page — see useRentalObjectDetails.
  const pageRentalIds = useMemo(
    () => search.objects.map((o) => o.rentalId),
    [search.objects]
  )
  const details = useRentalObjectDetails(pageRentalIds)

  // Rows already on screen belong to the previous scope until this settles.
  const refreshing = search.isFetching && !search.isLoading

  const columns = useMemo(
    () =>
      [
        ...BASE_COLUMNS,
        ...OPTIONAL_COLUMNS.filter((c) => extraColumns.has(c.key)),
      ].map((column) => ({
        ...column,
        render: (o: RentalObject) => column.render(o, details.get(o.rentalId)),
      })),
    [extraColumns, details]
  )

  const toggleExtraColumn = (key: string) => {
    setExtraColumns((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  const handleToggleObjectType = (type: RentalObjectType) => {
    setActiveObjectTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        // The last active type can't be deselected (empty result).
        if (next.size === 1) return prev
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const handleToggleSubtype = (key: string) => {
    setActiveSubtypes((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  const handleApply = (
    nodes: PropertyTreeNode[],
    filters: PropertyTreeFilters
  ) => {
    setAppliedNodes(nodes)
    setAppliedFilters(filters)
    setPage(1)
  }

  const removeNode = (node: PropertyTreeNode) => {
    setAppliedNodes((prev) => prev.filter((n) => n.key !== node.key))
    selectionState.pruneKey(node.key)
    setPage(1)
  }

  const clearAll = () => {
    setAppliedNodes([])
    setAppliedFilters(NO_FILTERS)
    selectionState.clear()
    setActiveObjectTypes(new Set(ALL_RENTAL_OBJECT_TYPES))
    setActiveSubtypes(new Set())
    setPage(1)
  }

  const filterChips = [
    ...appliedFilters.objectTypes.map((type) => ({
      key: `type:${type}`,
      text: RENTAL_OBJECT_TYPE_LABELS[type],
    })),
    ...appliedFilters.subtypes.map((key) => ({
      key: `subtype:${key}`,
      text: subtypeNames.get(key) ?? key,
    })),
  ]

  return (
    <div className="space-y-4">
      <PropertyTreePicker
        open
        onApply={handleApply}
        title="Avgränsa urvalet"
        description="Kryssa i distrikt, fastigheter, byggnader eller trapphus för att lista deras hyresobjekt. Listan uppdateras direkt."
        applyMode="live"
        showIncludeDescendants={false}
        selectableObjects
        selection={selectionState.selection}
        onToggleNode={selectionState.toggle}
        onSelectNodes={selectionState.selectMany}
        onDeselectNodes={selectionState.deselectMany}
        activeObjectTypes={activeObjectTypes}
        onToggleObjectType={handleToggleObjectType}
        activeSubtypes={activeSubtypes}
        onToggleSubtype={handleToggleSubtype}
      />

      {(appliedNodes.length > 0 || filterChips.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {appliedNodes.map((node) => (
            <span
              key={node.key}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium"
            >
              <span className="text-muted-foreground">
                {LEVEL_LABELS[node.level]}:
              </span>
              {node.label}
              <button
                type="button"
                onClick={() => removeNode(node)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Ta bort ${node.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium"
            >
              {chip.text}
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Rensa urval
          </Button>
        </div>
      )}

      {!search.enabled ? (
        <div className="py-8 text-center text-muted-foreground">
          Välj distrikt, fastighet eller byggnad i urvalet för att lista
          hyresobjekt.
        </div>
      ) : search.isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Laddar hyresobjekt...
        </div>
      ) : search.error ? (
        <div className="py-8 text-center text-destructive">
          Ett fel uppstod vid hämtning av hyresobjekt
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            {/* keepPreviousData leaves the old scope's rows on screen while a
                new one loads; say so, or a swapped district looks applied. */}
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uppdaterar urvalet...
                </>
              ) : (
                `${search.totalCount} hyresobjekt`
              )}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Lägg till kolumner"
                  title="Lägg till kolumner"
                >
                  <Plus className="h-4 w-4" />
                  {extraColumns.size > 0 && ` ${extraColumns.size}`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Valbara kolumner
                </DropdownMenuLabel>
                {OPTIONAL_COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={extraColumns.has(column.key)}
                    // Keeps the menu open so several columns can be added.
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => toggleExtraColumn(column.key)}
                  >
                    <span className="truncate">{column.label}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div
            className={
              refreshing
                ? 'pointer-events-none opacity-50 transition-opacity'
                : 'transition-opacity'
            }
          >
            <ResponsiveTable
              data={search.objects}
              columns={columns}
              keyExtractor={(o: RentalObject) => o.rentalId}
              emptyMessage="Inga hyresobjekt hittades"
            />
          </div>
          <Pagination
            currentPage={page}
            totalPages={search.totalPages}
            totalRecords={search.totalCount}
            pageSize={RENTAL_OBJECT_PAGE_SIZE}
            onPageChange={setPage}
            isFetching={search.isFetching}
          />
        </>
      )}
    </div>
  )
}
