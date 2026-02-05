/**
 * InspectionsTable Column Configurations
 *
 * Defines reusable column configurations for inspection tables.
 * Uses ResponsiveTable column format for mobile/desktop support.
 */

import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import { Eye } from 'lucide-react'
import { components } from '@/services/api/core/generated/api-types'
import { getStatusConfig } from './statuses'
import type { ReactNode } from 'react'

type Inspection = components['schemas']['Inspection']

/**
 * Column configuration interface (compatible with ResponsiveTable)
 */
export interface InspectionTableColumn {
  key: string
  label: string
  render: (inspection: Inspection) => ReactNode
  className?: string
  hideOnMobile?: boolean
}

/**
 * Helper: Format Swedish date
 */
function formatSwedishDate(date: string | null | undefined): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('sv-SE')
}

/**
 * Helper: Get main phone number from inspection
 */
function getMainPhoneNumber(inspection: Inspection): string {
  return (
    inspection.lease?.tenants?.[0]?.phoneNumbers?.find(
      (number) => number.isMainNumber
    )?.phoneNumber || 'N/A'
  )
}

/**
 * Helper: Format master key access
 */
function formatMasterKeyAccess(value: string | null | undefined): string {
  if (!value) return 'Okänt'
  return value === 'Huvudnyckel' ? 'Ja' : 'Nej'
}

/**
 * Base inspection table columns (without actions)
 */
export const INSPECTION_TABLE_COLUMNS = {
  inspector: {
    key: 'inspector',
    label: 'Tilldelad',
    render: (inspection: Inspection) => inspection.inspector || 'N/A',
    hideOnMobile: false,
  },
  type: {
    key: 'type',
    label: 'Prioritet',
    render: (inspection: Inspection) => inspection.type || 'inflytt',
    hideOnMobile: true,
  },
  leaseId: {
    key: 'leaseId',
    label: 'Kontrakt ID',
    render: (inspection: Inspection) => inspection.leaseId || 'N/A',
    hideOnMobile: true,
  },
  address: {
    key: 'address',
    label: 'Adress',
    render: (inspection: Inspection) => inspection.address || 'N/A',
    hideOnMobile: false,
  },
  phone: {
    key: 'phone',
    label: 'Telefonnummer',
    render: (inspection: Inspection) => getMainPhoneNumber(inspection),
    hideOnMobile: true,
  },
  masterKey: {
    key: 'masterKey',
    label: 'Huvudnyckel',
    render: (inspection: Inspection) =>
      formatMasterKeyAccess(inspection.masterKeyAccess),
    hideOnMobile: true,
  },
  terminationDate: {
    key: 'terminationDate',
    label: 'Uppsägning',
    render: (inspection: Inspection) => (
      <span className="whitespace-nowrap">
        {formatSwedishDate(inspection.lease?.lastDebitDate)}
      </span>
    ),
    hideOnMobile: true,
  },
  date: {
    key: 'date',
    label: 'Planerat datum/tid',
    render: (inspection: Inspection) => (
      <span className="whitespace-nowrap">
        {formatSwedishDate(inspection.date)}
      </span>
    ),
    hideOnMobile: true,
  },
  dateCompleted: {
    key: 'dateCompleted',
    label: 'Utfört',
    render: (inspection: Inspection) => (
      <span className="whitespace-nowrap">
        {formatSwedishDate(inspection.date)}
      </span>
    ),
    hideOnMobile: true,
  },
  id: {
    key: 'id',
    label: 'Besiktningsnummer',
    render: (inspection: Inspection) => (
      <span className="text-sm">{inspection.id || 'N/A'}</span>
    ),
    hideOnMobile: true,
  },
  status: {
    key: 'status',
    label: 'Status',
    render: (inspection: Inspection) => (
      <Badge variant={getStatusConfig(inspection.status).badgeVariant}>
        {getStatusConfig(inspection.status).label}
      </Badge>
    ),
    hideOnMobile: false,
  },
} as const

/**
 * Create actions column with click handler
 */
export function createActionsColumn(
  onAction: (inspection: Inspection) => void
): InspectionTableColumn {
  return {
    key: 'actions',
    label: 'Åtgärder',
    className: 'text-right',
    render: (inspection: Inspection) => (
      <Button variant="ghost" size="sm" onClick={() => onAction(inspection)}>
        <Eye className="h-4 w-4 mr-1" />
        {getStatusConfig(inspection.status).actionLabel}
      </Button>
    ),
    hideOnMobile: false,
  }
}

/**
 * Get columns for ongoing inspections
 */
export function getOngoingInspectionColumns(
  onAction: (inspection: Inspection) => void
): InspectionTableColumn[] {
  return [
    INSPECTION_TABLE_COLUMNS.inspector,
    INSPECTION_TABLE_COLUMNS.type,
    INSPECTION_TABLE_COLUMNS.leaseId,
    INSPECTION_TABLE_COLUMNS.address,
    INSPECTION_TABLE_COLUMNS.phone,
    INSPECTION_TABLE_COLUMNS.masterKey,
    INSPECTION_TABLE_COLUMNS.terminationDate,
    INSPECTION_TABLE_COLUMNS.date,
    INSPECTION_TABLE_COLUMNS.id,
    INSPECTION_TABLE_COLUMNS.status,
    createActionsColumn(onAction),
  ]
}

/**
 * Get columns for completed inspections
 */
export function getCompletedInspectionColumns(
  onAction: (inspection: Inspection) => void
): InspectionTableColumn[] {
  return [
    INSPECTION_TABLE_COLUMNS.inspector,
    INSPECTION_TABLE_COLUMNS.type,
    INSPECTION_TABLE_COLUMNS.leaseId,
    INSPECTION_TABLE_COLUMNS.address,
    INSPECTION_TABLE_COLUMNS.phone,
    INSPECTION_TABLE_COLUMNS.masterKey,
    INSPECTION_TABLE_COLUMNS.terminationDate,
    INSPECTION_TABLE_COLUMNS.dateCompleted,
    INSPECTION_TABLE_COLUMNS.id,
    INSPECTION_TABLE_COLUMNS.status,
    createActionsColumn(onAction),
  ]
}

/**
 * Mobile card renderer for inspections
 * Provides compact mobile view with essential information
 */
export function renderInspectionMobileCard(
  onAction: (inspection: Inspection) => void
) {
  return (inspection: Inspection): ReactNode => (
    <div className="space-y-2 w-full">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{inspection.address || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">
            {inspection.inspector || 'N/A'}
          </p>
        </div>
        <Badge
          variant={getStatusConfig(inspection.status).badgeVariant}
          className="shrink-0"
        >
          {getStatusConfig(inspection.status).label}
        </Badge>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {formatSwedishDate(inspection.date)}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onAction(inspection)}>
          <Eye className="h-4 w-4 mr-1" />
          {getStatusConfig(inspection.status).actionLabel}
        </Button>
      </div>
    </div>
  )
}
