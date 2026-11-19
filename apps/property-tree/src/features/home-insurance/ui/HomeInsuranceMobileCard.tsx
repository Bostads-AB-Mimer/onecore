import type { HomeInsuranceListItem } from '@/services/api/core/homeInsuranceService'

import { formatSek } from '@/shared/lib/formatters'

import { renderTenant } from '../constants/tableColumns'
import { formatLfStatus } from '../lib/homeInsuranceFilters'
import { HomeInsuranceRowAction } from './HomeInsuranceRowAction'

export function HomeInsuranceMobileCard(row: HomeInsuranceListItem) {
  return (
    <div className="space-y-2 w-full text-sm">
      <div className="flex justify-between items-start">
        <span className="font-medium">{row.leaseId}</span>
        <span>{formatLfStatus(row.leaseStatus)}</span>
      </div>
      {renderTenant(row)}
      <div className="text-muted-foreground">{row.address || '-'}</div>
      <div className="flex justify-between">
        <span>
          {row.rowFromDate ?? '-'} – {row.rowToDate ?? '-'}
        </span>
        <span>{formatSek(row.monthlyAmount)}</span>
      </div>
      <HomeInsuranceRowAction row={row} />
    </div>
  )
}
