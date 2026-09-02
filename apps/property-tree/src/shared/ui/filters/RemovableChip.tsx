import type { ReactNode } from 'react'
import { X } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

/** An applied-filter tag; with onRemove it carries an X, without it is passive. */
export const RemovableChip = ({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
}) => (
  <Badge
    variant="secondary"
    className="px-3 py-1 text-sm flex items-center gap-2"
  >
    <span>{children}</span>
    {onRemove && (
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 hover:bg-transparent"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X className="h-3 w-3" />
      </Button>
    )}
  </Badge>
)
