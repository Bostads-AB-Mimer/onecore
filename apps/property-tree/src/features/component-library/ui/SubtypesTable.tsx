import type { ComponentSubtype } from '@/services/types'

import { sortBySwedishName } from '@/shared/lib/sortByName'
import { type Column, DataTable } from '@/shared/ui/DataTable'

import { formatSek, QUANTITY_UNIT_LABELS } from '../lib/componentRows'

interface SubtypesTableProps {
  subtypes: ComponentSubtype[]
  isLoading: boolean
  onEdit: (subtype: ComponentSubtype) => void
  onDelete: (subtype: ComponentSubtype) => void
  onNavigate: (subtype: ComponentSubtype) => void
  getHref: (subtype: ComponentSubtype) => string
}

export const SubtypesTable = ({
  subtypes,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
  getHref,
}: SubtypesTableProps) => {
  const columns: Column<ComponentSubtype>[] = [
    {
      key: 'name',
      label: 'Namn',
      render: (item) => <div className="font-medium">{item.subTypeName}</div>,
    },
    {
      key: 'xpandCode',
      label: 'Xpand-kod',
      isEmpty: (item) => !item.xpandCode,
      render: (item) => (
        <span className="text-muted-foreground">{item.xpandCode || '-'}</span>
      ),
    },
    {
      key: 'technicalLifespan',
      label: 'Teknisk livslängd',
      isEmpty: (item) => !item.technicalLifespan,
      render: (item) => (
        <span
          className={!item.technicalLifespan ? 'text-muted-foreground' : ''}
        >
          {item.technicalLifespan ? `${item.technicalLifespan} år` : '-'}
        </span>
      ),
    },
    {
      key: 'economicLifespan',
      label: 'Ekonomisk livslängd',
      isEmpty: (item) => !item.economicLifespan,
      render: (item) => (
        <span className={!item.economicLifespan ? 'text-muted-foreground' : ''}>
          {item.economicLifespan ? `${item.economicLifespan} år` : '-'}
        </span>
      ),
    },
    {
      key: 'depreciationPrice',
      label: 'Avskrivningspris',
      isEmpty: (item) => !item.depreciationPrice,
      render: (item) => (
        <span
          className={!item.depreciationPrice ? 'text-muted-foreground' : ''}
        >
          {formatSek(item.depreciationPrice)}
        </span>
      ),
    },
    {
      key: 'replacementIntervalMonths',
      label: 'Utbytesintervall',
      isEmpty: (item) => !item.replacementIntervalMonths,
      render: (item) => (
        <span
          className={
            !item.replacementIntervalMonths ? 'text-muted-foreground' : ''
          }
        >
          {item.replacementIntervalMonths
            ? `${item.replacementIntervalMonths} mån`
            : '-'}
        </span>
      ),
    },
    {
      key: 'quantityType',
      label: 'Enhet',
      isEmpty: (item) => item.quantityType === 'UNIT',
      render: (item) => <span>{QUANTITY_UNIT_LABELS[item.quantityType]}</span>,
    },
  ]

  return (
    <DataTable
      data={sortBySwedishName(subtypes, (item) => item.subTypeName)}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      getRowHref={getHref}
      pageSize={50}
      emptyMessage="Inga undertyper"
      getRowLabel={(item) => item.subTypeName}
    />
  )
}
