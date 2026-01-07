import { CardDetails } from '@/services/types'
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
  cards: CardDetails[]
}

export function MaintenanceCardsTable({ cards }: Props) {
  if (!cards || cards.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Inga droppar i detta lån
      </div>
    )
  }

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Droppnamn</TableHead>
            <TableHead className="w-[30%]">Hyresobjekt</TableHead>
            <TableHead className="w-[30%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow key={card.cardId}>
              <TableCell className="font-medium w-[40%]">
                {card.name || card.cardId}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground w-[30%]">
                {card.rentalObjectCode || '—'}
              </TableCell>
              <TableCell className="w-[30%]">
                {card.disabled ? (
                  <Badge variant="destructive">Inaktiv</Badge>
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
