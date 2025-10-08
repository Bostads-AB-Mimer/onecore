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
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Key, KeyTypeLabels, getKeyTypeFilterOptions } from '@/services/types'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'

interface KeysTableProps {
  keys: Key[]
  keySystemMap: Record<string, string>
  onEdit: (key: Key) => void
  onDelete: (keyId: string) => void
  selectedType: string | null
  onTypeFilterChange: (value: string | null) => void
  createdAtAfter: string | null
  createdAtBefore: string | null
  onDatesChange: (afterDate: string | null, beforeDate: string | null) => void
}

export function KeysTable({
  keys,
  keySystemMap,
  onEdit,
  onDelete,
  selectedType,
  onTypeFilterChange,
  createdAtAfter,
  createdAtBefore,
  onDatesChange,
}: KeysTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'LGH':
        return 'default'
      case 'PB':
        return 'secondary'
      case 'FS':
        return 'outline'
      case 'HN':
        return 'destructive'
      default:
        return 'default'
    }
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="font-medium">Nyckelnamn</TableHead>
            <TableHead className="font-medium">Objekt</TableHead>
            <TableHead className="font-medium">
              <div className="flex items-center gap-1">
                Typ
                <FilterDropdown
                  options={getKeyTypeFilterOptions()}
                  selectedValue={selectedType}
                  onSelectionChange={onTypeFilterChange}
                />
              </div>
            </TableHead>
            <TableHead className="font-medium">Låssystem</TableHead>
            <TableHead className="font-medium">Löpnummer</TableHead>
            <TableHead className="font-medium">Flexnr</TableHead>
            <TableHead className="font-medium">
              <div className="flex items-center gap-1">
                Skapad
                <DateRangeFilterDropdown
                  afterDate={createdAtAfter}
                  beforeDate={createdAtBefore}
                  onDatesChange={onDatesChange}
                />
              </div>
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center py-8 text-muted-foreground"
              >
                Inga nycklar hittades
              </TableCell>
            </TableRow>
          ) : (
            keys.map((key) => (
              <TableRow key={key.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{key.keyName}</TableCell>
                <TableCell>{key.rentalObjectCode || '-'}</TableCell>
                <TableCell>
                  <Badge
                    variant={getTypeVariant(key.keyType)}
                    className="text-xs"
                  >
                    {KeyTypeLabels[key.keyType]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {key.keySystemId && keySystemMap[key.keySystemId]
                    ? keySystemMap[key.keySystemId]
                    : key.keySystemId || '-'}
                </TableCell>
                <TableCell>{key.keySequenceNumber || '-'}</TableCell>
                <TableCell>{key.flexNumber || '-'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(key.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(key)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Redigera
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(key.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Ta bort
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
