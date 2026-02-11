import {
  Table,
  TableBody,
  TableCell,
  TableCellMuted,
  TableHead,
  TableHeader,
  TableRow,
  TableLink,
} from '@/components/ui/table'
import type { Key } from '@/services/types'
import { KeyTypeBadge, DisposedBadge } from './StatusBadges'

interface KeysListProps {
  keys: Key[]
  keySystemMap?: Record<string, string>
}

/** Simple table for displaying a list of keys */
export function KeysList({ keys, keySystemMap = {} }: KeysListProps) {
  if (keys.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">Inga nycklar</div>
    )
  }

  return (
    <Table>
      <TableHeader className="border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-14">Nyckelnamn</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Låssystem</TableHead>
          <TableHead>Hyresobjekt</TableHead>
          <TableHead>Flexnummer</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key.id} className="h-12 hover:bg-muted/50">
            <TableCell className="font-medium pl-14">
              <TableLink
                to={`/Keys?q=${encodeURIComponent(key.keyName)}${key.rentalObjectCode ? `&rentalObjectCode=${key.rentalObjectCode}` : ''}&disposed=false`}
              >
                {key.keyName}
              </TableLink>
            </TableCell>
            <TableCell>
              <KeyTypeBadge keyType={key.keyType} />
            </TableCell>
            <TableCellMuted>
              {key.keySystemId && keySystemMap[key.keySystemId]
                ? keySystemMap[key.keySystemId]
                : '-'}
            </TableCellMuted>
            <TableCellMuted>{key.rentalObjectCode || '-'}</TableCellMuted>
            <TableCellMuted>{key.flexNumber || '-'}</TableCellMuted>
            <TableCell>
              <DisposedBadge disposed={key.disposed ?? false} showActive />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
