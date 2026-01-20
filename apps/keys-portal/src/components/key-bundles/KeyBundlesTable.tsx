import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { KeyBundle, KeyDetails } from '@/services/types'
import { KeyBundleKeysTable } from '@/components/maintenance/KeyBundleKeysTable'

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
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (keyBundles.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Inga nyckelsamlingar hittades
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Namn</TableHead>
            <TableHead>Beskrivning</TableHead>
            <TableHead>Antal nycklar</TableHead>
            <TableHead className="text-right">Åtgärder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keyBundles.map((bundle) => {
            const isExpanded = expandedBundleId === bundle.id
            let keyCount = 0
            try {
              const keys = JSON.parse(bundle.keys)
              keyCount = Array.isArray(keys) ? keys.length : 0
            } catch (e) {
              keyCount = 0
            }

            return (
              <>
                {/* Main bundle row */}
                <TableRow key={bundle.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleExpand(bundle.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{bundle.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {bundle.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{keyCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(bundle)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Redigera
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(bundle.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Ta bort
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>

                {/* Expanded keys section - delegates to KeyBundleKeysTable */}
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-4 bg-muted/30">
                      {isLoadingKeys ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : (
                        <KeyBundleKeysTable
                          keys={keysForExpandedBundle}
                          bundleId={bundle.id}
                          onRefresh={onRefresh}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
