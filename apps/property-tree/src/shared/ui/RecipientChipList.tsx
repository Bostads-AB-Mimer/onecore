import { memo, useState } from 'react'
import { User, X } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'

// Display-only cap — rendering thousands of chips freezes the UI. Every
// recipient stays in state, counters and the send payload regardless.
const INITIAL_VISIBLE = 100
const VISIBLE_INCREMENT = 200

interface RecipientChipListProps {
  recipients: { id: string; name: string }[]
  onRemove: (id: string) => void
}

/**
 * Bulk-send recipient chips with a remove button per chip. Memoized so
 * keystrokes in the surrounding form don't re-render a large list.
 */
export const RecipientChipList = memo(function RecipientChipList({
  recipients,
  onRemove,
}: RecipientChipListProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  const visibleRecipients =
    recipients.length > visibleCount
      ? recipients.slice(0, visibleCount)
      : recipients
  const hiddenCount = recipients.length - visibleRecipients.length

  return (
    <div className="mt-2 flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 border rounded-md bg-muted/30">
      {visibleRecipients.map((recipient) => (
        <Badge
          key={recipient.id}
          variant="secondary"
          className="flex items-center gap-1"
        >
          <User className="h-3 w-3" />
          {recipient.name}
          <button
            type="button"
            aria-label={`Ta bort ${recipient.name}`}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            onClick={() => onRemove(recipient.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="text-sm text-muted-foreground underline hover:text-foreground"
          onClick={() => setVisibleCount((c) => c + VISIBLE_INCREMENT)}
        >
          Visa fler ({hiddenCount.toLocaleString('sv-SE')} till)
        </button>
      )}
    </div>
  )
})
