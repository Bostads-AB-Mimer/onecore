import { Key } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
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
import { Badge } from '@/components/ui/badge'

type Props = {
  keys: Key[]
  keySystemMap: Record<string, string>
}

function getKeySearchUrl(key: Key) {
  const params = new URLSearchParams({ disposed: 'false', q: key.keyName })
  if (key.rentalObjectCode) {
    params.set('rentalObjectCode', key.rentalObjectCode)
  }
  return `/Keys?${params.toString()}`
}

export function MaintenanceKeysTable({ keys, keySystemMap }: Props) {
  if (!keys || keys.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Inga nycklar i detta lån
      </div>
    )
  }

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Nyckelnamn</TableHead>
            <TableHead className="w-[12%]">Typ</TableHead>
            <TableHead className="w-[15%]">Låssystem</TableHead>
            <TableHead className="w-[15%]">Hyresobjekt</TableHead>
            <TableHead className="w-[13%]">Flexnummer</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium w-[30%]">
                <TableLink to={getKeySearchUrl(key)}>{key.keyName}</TableLink>
              </TableCell>
              <TableCell className="w-[12%]">
                <Badge variant="outline">
                  {KeyTypeLabels[key.keyType] || key.keyType}
                </Badge>
              </TableCell>
              <TableCellMuted className="w-[15%]">
                {key.keySystemId && keySystemMap[key.keySystemId]
                  ? keySystemMap[key.keySystemId]
                  : key.keySystemId || '—'}
              </TableCellMuted>
              <TableCellMuted className="w-[15%]">
                {key.rentalObjectCode || '—'}
              </TableCellMuted>
              <TableCellMuted className="w-[13%]">
                {key.flexNumber || '—'}
              </TableCellMuted>
              <TableCell className="w-[15%]">
                {key.disposed ? (
                  <Badge variant="destructive">Kasserad</Badge>
                ) : (
                  <Badge variant="secondary">Aktiv</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
