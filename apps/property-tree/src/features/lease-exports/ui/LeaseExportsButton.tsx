import { Download, Loader2 } from 'lucide-react'

import { useLeaseExports } from '@/entities/lease'

import { Button } from '@/shared/ui/Button'

import { useLeaseExportNotifications } from '../hooks/useLeaseExportNotifications'
import { useLeaseExportsSheet } from '../hooks/useLeaseExportsSheet'

/** Also keeps polling and toasts running on every page. */
export function LeaseExportsButton() {
  const { open } = useLeaseExportsSheet()
  const { exports, runningExport } = useLeaseExports()
  useLeaseExportNotifications(exports)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={open}
      className="relative min-h-[44px] min-w-[44px]"
      title="Mina exporter"
      aria-label="Mina exporter"
    >
      <Download className="h-5 w-5" />
      {runningExport && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground box-content">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        </span>
      )}
    </Button>
  )
}
