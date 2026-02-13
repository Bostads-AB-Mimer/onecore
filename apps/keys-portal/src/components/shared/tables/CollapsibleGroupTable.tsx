import React, { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCollapsibleSections } from '@/hooks/useCollapsibleSections'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'

/** Minimal selection interface — satisfied by UseItemSelectionReturn or a custom bridge */
export interface TableSelectionProps {
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
}

export interface RowRenderProps {
  isSelected: boolean
  onToggleSelect: () => void
  indent: boolean // Whether the row should be indented (when inside a group)
}

export interface ItemGroup<T> {
  groupKey: string
  items: T[]
}

export interface Section<T> {
  sectionKey: string
  groups: ItemGroup<T>[]
  ungroupedItems: T[] // Items with no group key
}

export interface CollapsibleGroupTableProps<T> {
  items: T[]
  getItemId: (item: T) => string
  renderHeader: () => React.ReactNode
  renderRow: (item: T, rowProps: RowRenderProps) => React.ReactNode
  renderGroupHeader?: (groupKey: string, items: T[]) => React.ReactNode
  renderSectionHeader?: (sectionKey: string, items: T[]) => React.ReactNode
  groupBy?: (item: T) => string | null // Return null for ungrouped items
  sectionBy?: (item: T) => string // Top-level grouping (e.g., "loaned" vs "unloaned")
  sectionOrder?: string[] // Order of sections, others appear at end
  selection?: TableSelectionProps
  columnCount?: number // For colspan calculations
  className?: string
  /** Initial expanded state: 'all' = all expanded, 'none' = all collapsed. Default: 'all' */
  initialExpanded?: 'all' | 'none'
}

/** Composition-based table with collapsible groups and sections */
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
  selection,
  columnCount = 10,
  className,
  initialExpanded = 'all',
}: CollapsibleGroupTableProps<T>) {
  const sections = useCollapsibleSections({ initialExpanded })

  // Group and section the items
  const groupedSections = useMemo(() => {
    const sectionMap = new Map<string, Section<T>>()

    items.forEach((item) => {
      const sectionKey = sectionBy?.(item) ?? 'default'
      const groupKey = groupBy?.(item) ?? null

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

    return orderedSections
  }, [items, sectionBy, groupBy, sectionOrder])

  // Collect all collapsible section IDs for the toggle function
  const allCollapsibleIds = useMemo(() => {
    const ids: string[] = []
    groupedSections.forEach((section) => {
      ids.push(section.sectionKey)
      section.groups.forEach((group) => {
        ids.push(`${section.sectionKey}-${group.groupKey}`)
      })
    })
    return ids
  }, [groupedSections])

  const createRowProps = (item: T): RowRenderProps => {
    const id = getItemId(item)
    return {
      isSelected: selection?.isSelected(id) ?? false,
      onToggleSelect: () => selection?.toggle(id),
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
            className="bg-muted/50 hover:bg-muted/70 cursor-pointer border-t"
            onClick={() => sections.toggle(groupSectionKey, allCollapsibleIds)}
          >
            <TableCell colSpan={columnCount} className="font-medium py-3 pl-6">
              <div className="flex items-center gap-2">
                <ExpandButton
                  isExpanded={isExpanded}
                  onClick={() =>
                    sections.toggle(groupSectionKey, allCollapsibleIds)
                  }
                />
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

    // Get the section header content - if null, we skip rendering the header row
    const sectionHeaderContent = renderSectionHeader
      ? renderSectionHeader(section.sectionKey, allItemsInSection)
      : null
    const showSectionHeader =
      renderSectionHeader && sectionHeaderContent !== null

    return (
      <React.Fragment key={section.sectionKey}>
        {showSectionHeader && (
          <TableRow
            className="bg-muted hover:bg-muted/80 cursor-pointer"
            onClick={() =>
              sections.toggle(section.sectionKey, allCollapsibleIds)
            }
          >
            <TableCell colSpan={columnCount} className="font-semibold py-3">
              <div className="flex items-center gap-2">
                <ExpandButton
                  isExpanded={isExpanded}
                  onClick={() =>
                    sections.toggle(section.sectionKey, allCollapsibleIds)
                  }
                />
                {sectionHeaderContent}
              </div>
            </TableCell>
          </TableRow>
        )}
        {(isExpanded || !showSectionHeader) && (
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
          {groupedSections.map(renderSection)}

          {items.length === 0 && (
            <TableEmptyState
              colSpan={columnCount}
              message="Inga objekt att visa"
            />
          )}
        </TableBody>
      </Table>
    </div>
  )
}
