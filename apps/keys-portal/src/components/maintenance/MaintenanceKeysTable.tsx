import { useNavigate } from 'react-router-dom'
import { Key } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type Props = {
  keys: Key[]
  keySystemMap: Record<string, string>
}

export function MaintenanceKeysTable({ keys, keySystemMap }: Props) {
  const navigate = useNavigate()

  const handleEditKey = (key: Key) => {
    // Navigate to Keys page with search query for key name and rental object code
    const params = new URLSearchParams({
      disposed: 'false',
      q: key.keyName,
    })

    // Always add rentalObjectCode if available
    if (key.rentalObjectCode) {
      params.set('rentalObjectCode', key.rentalObjectCode)
    }

    navigate(`/Keys?${params.toString()}`)
  }

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
                <button
                  onClick={() => handleEditKey(key)}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                >
                  {key.keyName}
                </button>
              </TableCell>
              <TableCell className="w-[12%]">
                <Badge variant="outline">
                  {KeyTypeLabels[key.keyType] || key.keyType}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground w-[15%]">
                {key.keySystemId && keySystemMap[key.keySystemId]
                  ? keySystemMap[key.keySystemId]
                  : key.keySystemId || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground w-[15%]">
                {key.rentalObjectCode || '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground w-[13%]">
                {key.flexNumber || '—'}
              </TableCell>
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
