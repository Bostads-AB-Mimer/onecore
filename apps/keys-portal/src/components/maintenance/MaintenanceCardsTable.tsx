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
                  {ownerLink ? (
                    <a
                      href={ownerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {card.name || card.cardId}
                    </a>
                  ) : (
                    card.name || card.cardId
                  )}
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
