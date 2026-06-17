import { ShieldAlert } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/Tooltip'

type Size = 'sm' | 'md'

interface ProtectedIdentityBadgeProps {
  size?: Size
}

const SIZE_CLASSES: Record<Size, { wrapper: string; icon: string }> = {
  sm: { wrapper: 'w-5 h-5', icon: 'h-3 w-3' },
  md: { wrapper: 'w-8 h-8', icon: 'h-4 w-4' },
}

export function ProtectedIdentityBadge({
  size = 'md',
}: ProtectedIdentityBadgeProps) {
  const { wrapper, icon } = SIZE_CLASSES[size]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center justify-center ${wrapper} bg-red-100 rounded-full border border-red-200 cursor-help shrink-0`}
            aria-label="Skyddad identitet"
          >
            <ShieldAlert className={`${icon} text-red-600`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Skyddad identitet. Hantera kunduppgifter med särskild varsamhet.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
