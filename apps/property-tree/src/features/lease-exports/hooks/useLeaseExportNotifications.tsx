import * as React from 'react'

import {
  downloadLeaseExport,
  findSettledExports,
  leaseExportFailureText,
  leaseExportLabel,
} from '@/entities/lease'

import type { LeaseExport } from '@/services/api/core/leaseExportService'

import { toast } from '@/shared/hooks/useToast'
import { ToastAction } from '@/shared/ui/Toast'

/** Toasts when an export that was running has finished or failed. */
export function useLeaseExportNotifications(exports: LeaseExport[]) {
  const previous = React.useRef<LeaseExport[] | undefined>(undefined)

  React.useEffect(() => {
    const { finished, failed } = findSettledExports(previous.current, exports)
    previous.current = exports

    for (const leaseExport of finished) {
      toast({
        title: 'Exporten är klar',
        description: leaseExportLabel(leaseExport),
        action: (
          <ToastAction
            altText="Ladda ned exporten"
            onClick={() => void downloadLeaseExport(leaseExport.id)}
          >
            Ladda ned
          </ToastAction>
        ),
      })
    }

    for (const leaseExport of failed) {
      toast({
        variant: 'destructive',
        title: 'Exporten misslyckades',
        description: leaseExportFailureText(leaseExport.failureReason),
      })
    }
  }, [exports])
}
