import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { KeyDetails } from '@/services/types'
import {
  formatKeySystemLabel,
  formatKeySystemTooltip,
} from '@/utils/formatKeySystem'

interface SelectedKeyBadgeProps {
  selectedKey: KeyDetails
  onRemove: () => void
  disabled?: boolean
}

/**
 * Removable badge for a selected key: name, sequence number and key system.
 * The key system name is truncated; its full name and code show in a tooltip.
 */
export function SelectedKeyBadge({
  selectedKey,
  onRemove,
  disabled = false,
}: SelectedKeyBadgeProps) {
  const { keyName, keySequenceNumber, keySystem } = selectedKey

  return (
    <Badge
      variant="secondary"
      className="pl-3 pr-1 py-1.5 flex items-center gap-2"
    >
      <span className="text-sm">
        {keyName}
        {keySequenceNumber && (
          <span className="text-muted-foreground ml-1">
            · {keySequenceNumber}
          </span>
        )}
        {/* tabIndex on the trigger makes the tooltip reachable by keyboard */}
        {keySystem && (
          <span className="text-muted-foreground ml-1">
            ·{' '}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="inline-block max-w-[12rem] truncate align-bottom rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {formatKeySystemLabel(keySystem)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {formatKeySystemTooltip(keySystem)}
              </TooltipContent>
            </Tooltip>
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Ta bort ${keyName}`}
        className="hover:bg-muted rounded-full p-0.5 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}
