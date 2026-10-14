import type { ComponentSubtype } from '@/services/types'

import { sortBySwedishName } from '@/shared/lib/sortByName'
import { type Column, DataTable } from '@/shared/ui/DataTable'
import type { SortControl } from '@/shared/ui/dataTableSort'

import {
  formatComponentCount,
  formatSek,
  QUANTITY_UNIT_LABELS,
} from '../lib/componentRows'

interface SubtypesTableProps {
  subtypes: ComponentSubtype[]
  isLoading: boolean
  onEdit: (subtype: ComponentSubtype) => void
  onDelete: (subtype: ComponentSubtype) => void
  onNavigate: (subtype: ComponentSubtype) => void
  getHref: (subtype: ComponentSubtype) => string
  sort: SortControl
}

// The imports write 0 for unknown prices and lifespans; they sort as blanks.
const known = (value: number) => value || null

export const SubtypesTable = ({
  subtypes,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
  getHref,
  sort,
}: SubtypesTableProps) => {
  const columns: Column<ComponentSubtype>[] = [
    {
      key: 'name',
      label: 'Namn',
      render: (item) => <div className="font-medium">{item.subTypeName}</div>,
      sort: { value: (item) => item.subTypeName, kind: 'text' },
    },
    {
      key: 'componentCount',
      label: 'Komponenter',
      className: 'tabular-nums',
      render: (item) => formatComponentCount(item.componentCount),
      sort: {
        value: (item) => item.componentCount,
        kind: 'number',
        firstOrder: 'desc',
      },
    },
    {
      key: 'xpandCode',
      label: 'Xpand-kod',
      sort: { value: (item) => item.xpandCode, kind: 'text' },
      isEmpty: (item) => !item.xpandCode,
      render: (item) => (
        <span className="text-muted-foreground">{item.xpandCode || '-'}</span>
      ),
    },
    {
      key: 'technicalLifespan',
      sort: { value: (item) => known(item.technicalLifespan), kind: 'number' },
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
      sort: { value: (item) => known(item.economicLifespan), kind: 'number' },
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
      sort: { value: (item) => known(item.depreciationPrice), kind: 'number' },
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
      sort: {
        value: (item) => known(item.replacementIntervalMonths),
        kind: 'number',
      },
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
      sort: {
        value: (item) => QUANTITY_UNIT_LABELS[item.quantityType],
        kind: 'text',
      },
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
      sort={sort.value}
      defaultSort={sort.fallback}
      onSortChange={sort.onChange}
    />
  )
}
