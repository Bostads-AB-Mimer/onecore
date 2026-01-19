import React, { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCollapsibleSections } from '@/hooks/useCollapsibleSections'

/**
 * Props passed to the renderRow function
 */
export interface RowRenderProps {
  /** Whether this item is selected */
  isSelected: boolean
  /** Toggle selection for this item */
  onToggleSelect: () => void
  /** Whether the row should be indented (when inside a group) */
  indent: boolean
}

/**
 * A grouped set of items with a common group key
 */
export interface ItemGroup<T> {
  /** Unique key for this group */
  groupKey: string
  /** Items in this group */
  items: T[]
}

/**
 * A section containing multiple groups
 */
export interface Section<T> {
  /** Unique key for this section */
  sectionKey: string
  /** Groups within this section */
  groups: ItemGroup<T>[]
  /** Ungrouped items in this section (no group key) */
  ungroupedItems: T[]
}

export interface CollapsibleGroupTableProps<T> {
  /** Items to display in the table */
  items: T[]

  /** Get the unique ID for an item */
  getItemId: (item: T) => string

  // === COMPOSITION: Render props for full control ===

  /** Render the table header row(s) */
  renderHeader: () => React.ReactNode

  /** Render a single item row */
  renderRow: (item: T, rowProps: RowRenderProps) => React.ReactNode

  /** Render content for a group header (collapsible) */
  renderGroupHeader?: (groupKey: string, items: T[]) => React.ReactNode

  /** Render content for a section header (collapsible) */
  renderSectionHeader?: (sectionKey: string, items: T[]) => React.ReactNode

  // === GROUPING ===

  /**
   * Function to determine which group an item belongs to.
   * Return null for items that shouldn't be grouped.
   */
  groupBy?: (item: T) => string | null

  /**
   * Function to determine which section an item belongs to.
   * Sections are the top-level grouping (e.g., "loaned" vs "unloaned").
   * Return null for items that don't belong to a section.
   */
  sectionBy?: (item: T) => string | null

  /**
   * Order of sections. Sections not in this list appear at the end.
   */
  sectionOrder?: string[]

  // === SELECTION ===

  /** Enable selection checkboxes */
  selectable?: boolean

  /** Array of currently selected item IDs */
  selectedIds?: string[]

  /** Callback when an item's selection changes */
  onSelectionChange?: (id: string, checked: boolean) => void

  // === DISPLAY ===

  /** Get display name for a group key */
  getGroupDisplayName?: (groupKey: string) => string

  /** Get display name for a section key */
  getSectionDisplayName?: (sectionKey: string) => string

  /** Number of columns for colspan calculations */
  columnCount?: number

  /** Custom class name for the table wrapper */
  className?: string
}

/**
 * A composition-based table component for displaying items with collapsible groups and sections.
 *
 * The child component defines what to render (headers, rows) via render props,
 * while this component handles the structural concerns (grouping, collapsing, selection).
 *
 * @example
 * ```tsx
 * <CollapsibleGroupTable
 *   items={keys}
 *   getItemId={(key) => key.id}
 *   groupBy={(key) => getActiveLoan(key)?.contact || null}
 *   sectionBy={(key) => getActiveLoan(key) ? 'loaned' : 'unloaned'}
 *   selectable
 *   selectedIds={selectedKeys}
 *   onSelectionChange={onKeySelectionChange}
 *
 *   renderHeader={() => (
 *     <TableRow>
 *       <TableHead className="w-[50px]" />
 *       <TableHead>Nyckelnamn</TableHead>
 *       <TableHead>Löpnr</TableHead>
 *     </TableRow>
 *   )}
 *
 *   renderRow={(key, { isSelected, onToggleSelect }) => (
 *     <TableRow key={key.id}>
 *       <TableCell>
 *         <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
 *       </TableCell>
 *       <TableCell>{key.keyName}</TableCell>
 *       <TableCell>{key.keySequenceNumber}</TableCell>
 *     </TableRow>
 *   )}
 *
 *   renderGroupHeader={(contact, items) => (
 *     <span>{companyNames[contact] || contact}</span>
 *   )}
 *
 *   renderSectionHeader={(section) => (
 *     <span>{section === 'loaned' ? 'Utlånade' : 'Ej utlånade'}</span>
 *   )}
 * />
 * ```
 */
export function CollapsibleGroupTable<T>({
  items,
  getItemId,
  renderHeader,
  renderRow,
  renderGroupHeader,
  renderSectionHeader,
  groupBy,
  sectionBy,
  sectionOrder = [],
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  getGroupDisplayName,
  getSectionDisplayName,
  columnCount = 10,
  className,
}: CollapsibleGroupTableProps<T>) {
  const sections = useCollapsibleSections({ initialExpanded: 'all' })

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Group and section the items
  const groupedData = useMemo(() => {
    const result: Section<T>[] = []
    const sectionMap = new Map<string, Section<T>>()
    const noSectionItems: T[] = []

    items.forEach((item) => {
      const sectionKey = sectionBy?.(item) ?? null
      const groupKey = groupBy?.(item) ?? null

      if (sectionKey === null) {
        noSectionItems.push(item)
        return
      }

      let section = sectionMap.get(sectionKey)
      if (!section) {
        section = { sectionKey, groups: [], ungroupedItems: [] }
        sectionMap.set(sectionKey, section)
      }

      if (groupKey === null) {
        section.ungroupedItems.push(item)
      } else {
        let group = section.groups.find((g) => g.groupKey === groupKey)
        if (!group) {
          group = { groupKey, items: [] }
          section.groups.push(group)
        }
        group.items.push(item)
      }
    })

    // Sort sections by sectionOrder
    const orderedSections: Section<T>[] = []
    sectionOrder.forEach((key) => {
      const section = sectionMap.get(key)
      if (section) {
        orderedSections.push(section)
        sectionMap.delete(key)
      }
    })
    // Add remaining sections
    sectionMap.forEach((section) => orderedSections.push(section))

    return {
      sections: orderedSections,
      noSectionItems,
    }
  }, [items, sectionBy, groupBy, sectionOrder])

  const createRowProps = (item: T): RowRenderProps => {
    const id = getItemId(item)
    return {
      isSelected: selectedSet.has(id),
      onToggleSelect: () => onSelectionChange?.(id, !selectedSet.has(id)),
      indent: !!(groupBy || sectionBy),
    }
  }

  const renderItems = (itemList: T[], indent: boolean) => {
    return itemList.map((item) => {
      const rowProps = createRowProps(item)
      return renderRow(item, { ...rowProps, indent })
    })
  }

  const renderGroup = (group: ItemGroup<T>, sectionKey: string) => {
    const groupSectionKey = `${sectionKey}-${group.groupKey}`
    const isExpanded = sections.isExpanded(groupSectionKey)

    return (
      <React.Fragment key={groupSectionKey}>
        {renderGroupHeader && (
          <TableRow
            className="bg-muted/50 hover:bg-muted/70 cursor-pointer"
            onClick={() => sections.toggle(groupSectionKey)}
          >
            <TableCell colSpan={columnCount} className="font-medium py-3 pl-8">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {renderGroupHeader(group.groupKey, group.items)}
              </div>
            </TableCell>
          </TableRow>
        )}
        {(isExpanded || !renderGroupHeader) && renderItems(group.items, true)}
      </React.Fragment>
    )
  }

  const renderSection = (section: Section<T>) => {
    const isExpanded = sections.isExpanded(section.sectionKey)
    const allItemsInSection = [
      ...section.groups.flatMap((g) => g.items),
      ...section.ungroupedItems,
    ]

    return (
      <React.Fragment key={section.sectionKey}>
        {renderSectionHeader && (
          <TableRow
            className="bg-muted hover:bg-muted/80 cursor-pointer"
            onClick={() => sections.toggle(section.sectionKey)}
          >
            <TableCell colSpan={columnCount} className="font-semibold py-4">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {renderSectionHeader(section.sectionKey, allItemsInSection)}
              </div>
            </TableCell>
          </TableRow>
        )}
        {(isExpanded || !renderSectionHeader) && (
          <>
            {section.groups.map((group) =>
              renderGroup(group, section.sectionKey)
            )}
            {section.ungroupedItems.length > 0 &&
              renderItems(section.ungroupedItems, true)}
          </>
        )}
      </React.Fragment>
    )
  }

  return (
    <div className={className ?? 'border rounded-lg overflow-hidden'}>
      <Table>
        <TableHeader className="bg-background">{renderHeader()}</TableHeader>
        <TableBody>
          {/* Render sectioned items */}
          {groupedData.sections.map(renderSection)}

          {/* Render items without sections */}
          {groupedData.noSectionItems.length > 0 && (
            <>
              {groupBy ? (
                // If we have groupBy but no sectionBy, group the items
                (() => {
                  const groups = new Map<string, T[]>()
                  const ungrouped: T[] = []

                  groupedData.noSectionItems.forEach((item) => {
                    const key = groupBy(item)
                    if (key === null) {
                      ungrouped.push(item)
                    } else {
                      const existing = groups.get(key) || []
                      existing.push(item)
                      groups.set(key, existing)
                    }
                  })

                  return (
                    <>
                      {Array.from(groups.entries()).map(([groupKey, items]) => (
                        <React.Fragment key={groupKey}>
                          {renderGroupHeader && (
                            <TableRow
                              className="bg-muted hover:bg-muted/80 cursor-pointer"
                              onClick={() => sections.toggle(groupKey)}
                            >
                              <TableCell
                                colSpan={columnCount}
                                className="font-semibold py-4"
                              >
                                <div className="flex items-center gap-2">
                                  {sections.isExpanded(groupKey) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  {renderGroupHeader(groupKey, items)}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {(sections.isExpanded(groupKey) ||
                            !renderGroupHeader) &&
                            renderItems(items, true)}
                        </React.Fragment>
                      ))}
                      {renderItems(ungrouped, false)}
                    </>
                  )
                })()
              ) : (
                // No grouping, just render items
                renderItems(groupedData.noSectionItems, false)
              )}
            </>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="text-center py-8 text-muted-foreground"
              >
                Inga objekt att visa
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
