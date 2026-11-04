import tenfastIcon from '@/shared/assets/logos/tenfast-icon.webp'
import { Button } from '@/shared/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/Tooltip'

const LABEL = 'Öppna i Tenfast'

interface ExternalLeaseLinkProps {
  url?: string
}

/** Small icon link that opens the lease in Tenfast. Renders nothing without a url. */
export function ExternalLeaseLink({ url }: ExternalLeaseLinkProps) {
  if (!url) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label={LABEL}
          asChild
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            // Lease numbers are shown in clickable rows and cards
            onClick={(e) => e.stopPropagation()}
          >
            <img src={tenfastIcon} alt="" className="h-4 w-4" />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{LABEL}</TooltipContent>
    </Tooltip>
  )
}
