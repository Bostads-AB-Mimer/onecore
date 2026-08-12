import { ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'

interface AudienceFilterButtonProps {
  /** Whether the inline picker panel is open (drives the chevron). */
  open: boolean
  onToggle: () => void
  /** Number of active audience criteria (drives the active styling). */
  activeCount: number
}

/** Filter-bar toggle for the inline audience picker panel. */
export function AudienceFilterButton({
  open,
  onToggle,
  activeCount,
}: AudienceFilterButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      className={cn(
        'h-9 min-w-[130px] justify-between px-3 font-semibold',
        (activeCount > 0 || open) && 'border-primary text-primary'
      )}
    >
      <span className="max-w-[150px] truncate">
        {activeCount > 0 ? `Målgrupp +${activeCount}` : 'Målgrupp'}
      </span>
      <ChevronDown
        className={cn(
          'ml-2 h-3 w-3 shrink-0 transition-transform',
          open && 'rotate-180'
        )}
      />
    </Button>
  )
}
