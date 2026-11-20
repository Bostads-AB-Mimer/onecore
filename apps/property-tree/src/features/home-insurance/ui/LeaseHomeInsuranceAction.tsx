import { useLeaseHomeInsurance } from '@/entities/lease'
import { HOME_INSURANCE_WRITE_ROLE, RequireRole } from '@/entities/user'

import type { Lease } from '@/services/api/core/leaseService'

import { EndHomeInsuranceDialog } from './EndHomeInsuranceDialog'

function LeaseHomeInsurance({ lease }: { lease: Lease }) {
  const { data: row, isError } = useLeaseHomeInsurance(lease.leaseId)

  if (isError)
    return (
      <p className="mt-4 text-sm text-destructive">
        Kunde inte hämta kontraktets hemförsäkring.
      </p>
    )
  // Loading, or the lease has no home insurance.
  if (!row) return null

  return (
    <div className="mt-4 flex items-center gap-2 text-sm">
      <span>Hemförsäkring</span>
      <EndHomeInsuranceDialog
        leaseId={lease.leaseId}
        row={row}
        // The residence tab only shows the active lease (findActiveLease);
        // upcoming leases are handled from the list.
        isUpcomingLease={false}
      />
    </div>
  )
}

/** Ending the lease's home insurance, for staff with the write role. */
export function LeaseHomeInsuranceAction({ lease }: { lease: Lease }) {
  return (
    <RequireRole roles={[HOME_INSURANCE_WRITE_ROLE]}>
      <LeaseHomeInsurance lease={lease} />
    </RequireRole>
  )
}
