import { LeaseStatus } from '@/entities/lease'
import { HOME_INSURANCE_WRITE_ROLE, RequireRole } from '@/entities/user'

import type { HomeInsuranceListItem } from '@/services/api/core/homeInsuranceService'

import { EndHomeInsuranceDialog } from './EndHomeInsuranceDialog'

export function HomeInsuranceRowAction({
  row,
}: {
  row: HomeInsuranceListItem
}) {
  return (
    <RequireRole roles={[HOME_INSURANCE_WRITE_ROLE]}>
      <EndHomeInsuranceDialog
        leaseId={row.leaseId}
        row={{
          rowId: row.rowId,
          monthlyAmount: row.monthlyAmount,
          from: row.rowFromDate ?? undefined,
          to: row.rowToDate ?? undefined,
        }}
        isUpcomingLease={row.leaseStage === LeaseStatus.Upcoming}
      />
    </RequireRole>
  )
}
