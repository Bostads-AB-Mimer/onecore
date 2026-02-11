import { CardDetails } from '@/services/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableExternalLink,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { extractCardOwnerId, getCardOwnerLink } from '@/utils/externalLinks'

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
            <TableHead className="w-[70%]">Droppnamn</TableHead>
            <TableHead className="w-[30%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => {
            const ownerId = extractCardOwnerId(card.owner)
            const ownerLink = ownerId ? getCardOwnerLink(ownerId) : null

            return (
              <TableRow key={card.cardId}>
                <TableCell className="font-medium w-[70%]">
                  <TableExternalLink href={ownerLink}>
                    {card.name || card.cardId}
                  </TableExternalLink>
                </TableCell>
                <TableCell className="w-[30%]">
                  {card.disabled ? (
                    <Badge variant="destructive">Inaktiv</Badge>
                  ) : (
                    <Badge variant="secondary">Aktiv</Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
