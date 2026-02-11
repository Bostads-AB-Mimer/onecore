import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableCellMuted,
  TableHead,
  TableHeader,
  TableRow,
  TableLink,
  TableEmptyState,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { KeyBundle, KeyDetails } from '@/services/types'
import { KeyBundleKeysTable } from '@/components/maintenance/KeyBundleKeysTable'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import { ExpandedRowContent } from '@/components/shared/tables/ExpandedRowContent'

interface KeyBundlesTableProps {
  keyBundles: KeyBundle[]
  onEdit: (keyBundle: KeyBundle) => void
  onDelete: (id: string) => void
  expandedBundleId: string | null
  onToggleExpand: (bundleId: string) => void
  keysForExpandedBundle: KeyDetails[]
  isLoadingKeys: boolean
  isLoading: boolean
  onRefresh: () => void
}

export function KeyBundlesTable({
  keyBundles,
  onEdit,
  onDelete,
  expandedBundleId,
  onToggleExpand,
  keysForExpandedBundle,
  isLoadingKeys,
  isLoading,
  onRefresh,
}: KeyBundlesTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Namn</TableHead>
            <TableHead>Beskrivning</TableHead>
            <TableHead>Antal nycklar</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading || keyBundles.length === 0 ? (
            <TableEmptyState
              colSpan={5}
              message="Inga nyckelsamlingar hittades"
              isLoading={isLoading}
            />
          ) : (
            keyBundles.map((bundle) => {
              const isExpanded = expandedBundleId === bundle.id
              let keyCount = 0
              try {
                const keys = JSON.parse(bundle.keys)
                keyCount = Array.isArray(keys) ? keys.length : 0
              } catch (e) {
                keyCount = 0
              }

              return (
                <React.Fragment key={bundle.id}>
                  <TableRow>
                    <TableCell>
                      <ExpandButton
                        isExpanded={isExpanded}
                        isLoading={
                          isLoadingKeys && expandedBundleId === bundle.id
                        }
                        onClick={() => onToggleExpand(bundle.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <TableLink to={`/maintenance-keys?bundle=${bundle.id}`}>
                        {bundle.name}
                      </TableLink>
                    </TableCell>
                    <TableCellMuted>{bundle.description || '-'}</TableCellMuted>
                    <TableCell>
                      <Badge variant="secondary">{keyCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionMenu
                        onEdit={() => onEdit(bundle)}
                        onDelete={() => onDelete(bundle.id)}
                      />
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <ExpandedRowContent
                      colSpan={5}
                      isLoading={isLoadingKeys}
                      hasData={keysForExpandedBundle.length > 0}
                      emptyMessage="Inga nycklar i denna samling"
                    >
                      <KeyBundleKeysTable
                        keys={keysForExpandedBundle}
                        bundleId={bundle.id}
                        onRefresh={onRefresh}
                      />
                    </ExpandedRowContent>
                  )}
                </React.Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
