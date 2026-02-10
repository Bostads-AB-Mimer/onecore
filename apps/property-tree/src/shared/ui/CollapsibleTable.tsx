import { Fragment, ReactNode, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { Card } from '@/shared/ui/Card'
import { cn } from '@/shared/lib/utils'

export interface CollapsibleTableColumn<T> {
  key: string
  label: string
  render: (item: T) => ReactNode
  className?: string
  hideOnMobile?: boolean
}

export interface ExpansionConfig {
  allowMultiple?: boolean
  chevronPosition?: 'start' | 'end'
  chevronLabel?: string
  disableChevron?: boolean
  expandedClassName?: string
  animated?: boolean
}

export interface MobileCardConfig<T> {
  summaryRenderer: (item: T) => ReactNode
}

export interface CollapsibleTableProps<T> {
  data: T[]
  columns: CollapsibleTableColumn<T>[]
  keyExtractor: (item: T) => string
  expandedContentRenderer: (item: T) => ReactNode
  expansionConfig?: ExpansionConfig
  mobileCardConfig?: MobileCardConfig<T>
  emptyMessage?: string
  className?: string
  expandedKeys?: string[]
  onExpandedChange?: (expandedKeys: string[]) => void
  isExpandable?: (item: T) => boolean
}

const defaultExpansionConfig: ExpansionConfig = {
  allowMultiple: false,
  chevronPosition: 'end',
  chevronLabel: '',
  disableChevron: false,
  expandedClassName: '',
  animated: true,
}

export function CollapsibleTable<T>({
  data,
  columns,
  keyExtractor,
  expandedContentRenderer,
  expansionConfig: userExpansionConfig,
  mobileCardConfig,
  emptyMessage = 'Inga resultat hittades',
  className,
  expandedKeys: controlledExpandedKeys,
  onExpandedChange,
  isExpandable,
}: CollapsibleTableProps<T>) {
  const expansionConfig = { ...defaultExpansionConfig, ...userExpansionConfig }

  // State management
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<string[]>([])
  const expandedKeys = controlledExpandedKeys ?? internalExpandedKeys
  const setExpandedKeys = onExpandedChange ?? setInternalExpandedKeys

  // Toggle expansion handler
  const toggleExpansion = (key: string) => {
    if (expansionConfig.allowMultiple) {
      // Multiple expansion mode
      setExpandedKeys(
        expandedKeys.includes(key)
          ? expandedKeys.filter((k) => k !== key)
          : [...expandedKeys, key]
      )
    } else {
      // Single expansion mode (default)
      setExpandedKeys(expandedKeys.includes(key) ? [] : [key])
    }
  }

  const isExpanded = (key: string) => expandedKeys.includes(key)

  // Empty state
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  // Calculate column count for colSpan
  const columnCount = columns.length + (expansionConfig.disableChevron ? 0 : 1)

  // Desktop table rendering
  const desktopTable = (
    <div className={cn('hidden md:block overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {/* Optional chevron at start */}
            {expansionConfig.chevronPosition === 'start' &&
              !expansionConfig.disableChevron && (
                <TableHead className="w-10">
                  {expansionConfig.chevronLabel}
                </TableHead>
              )}

            {/* Column headers */}
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.label}
              </TableHead>
            ))}

            {/* Optional chevron at end */}
            {expansionConfig.chevronPosition === 'end' &&
              !expansionConfig.disableChevron && (
                <TableHead className="w-10">
                  {expansionConfig.chevronLabel}
                </TableHead>
              )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((item) => {
            const key = keyExtractor(item)
            const expanded = isExpanded(key)
            const expandable = isExpandable?.(item) ?? true

            return (
              <Fragment key={key}>
                {/* Main row */}
                <TableRow
                  onClick={() => expandable && toggleExpansion(key)}
                  className={cn(
                    'border-b',
                    expandable && 'cursor-pointer hover:bg-muted/30'
                  )}
                >
                  {/* Chevron at start */}
                  {expansionConfig.chevronPosition === 'start' &&
                    !expansionConfig.disableChevron && (
                      <TableCell className="p-3">
                        {expandable &&
                          (expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ))}
                      </TableCell>
                    )}

                  {/* Column cells */}
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render(item)}
                    </TableCell>
                  ))}

                  {/* Chevron at end */}
                  {expansionConfig.chevronPosition === 'end' &&
                    !expansionConfig.disableChevron && (
                      <TableCell className="p-3">
                        {expandable &&
                          (expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ))}
                      </TableCell>
                    )}
                </TableRow>

                {/* Expanded content row */}
                {expanded && (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="p-0">
                      <div
                        className={cn(
                          'bg-muted/50 border-l-4 border-primary/30 p-4 ml-4',
                          expansionConfig.expandedClassName
                        )}
                      >
                        {expandedContentRenderer(item)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )

  // Mobile card rendering
  const mobileCards = (
    <div className="md:hidden space-y-3">
      {data.map((item) => {
        const key = keyExtractor(item)
        const expanded = isExpanded(key)
        const expandable = isExpandable?.(item) ?? true

        return (
          <Card key={key} className="overflow-hidden">
            <div
              className={cn('p-4', expandable && 'cursor-pointer')}
              onClick={() => expandable && toggleExpansion(key)}
            >
              {/* Summary content */}
              {mobileCardConfig?.summaryRenderer(item)}

              {/* Expansion indicator */}
              {expandable && (
                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="ml-1">
                    {expanded ? 'Dölj detaljer' : 'Visa detaljer'}
                  </span>
                </div>
              )}
            </div>

            {/* Expanded content */}
            {expanded && (
              <div className="border-t bg-muted/30 p-4">
                {expandedContentRenderer(item)}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )

  return (
    <>
      {desktopTable}
      {mobileCards}
    </>
  )
}
