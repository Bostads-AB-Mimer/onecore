import type { ComponentSubtype } from '@/services/types'

import { Badge } from '@/shared/ui/Badge'
import { type Column, DataTable } from '@/shared/ui/DataTable'

interface SubtypesTableProps {
  subtypes: ComponentSubtype[]
  isLoading: boolean
  onEdit: (subtype: ComponentSubtype) => void
  onDelete: (subtype: ComponentSubtype) => void
  onNavigate: (subtype: ComponentSubtype) => void
}

export const SubtypesTable = ({
  subtypes,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
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
      render: (item) => (
        <span className="text-muted-foreground">{item.xpandCode || '-'}</span>
      ),
    },
    {
      key: 'technicalLifespan',
      label: 'Teknisk livslängd',
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
      render: (item) => (
        <span className={!item.economicLifespan ? 'text-muted-foreground' : ''}>
          {item.economicLifespan ? `${item.economicLifespan} år` : '-'}
        </span>
      ),
    },
    {
      key: 'depreciationPrice',
      label: 'Avskrivningspris',
      render: (item) => (
        <span
          className={!item.depreciationPrice ? 'text-muted-foreground' : ''}
        >
          {item.depreciationPrice
            ? item.depreciationPrice.toLocaleString('sv-SE', {
                style: 'currency',
                currency: 'SEK',
                maximumFractionDigits: 0,
              })
            : '-'}
        </span>
      ),
    },
    {
      key: 'replacementIntervalMonths',
      label: 'Utbytesintervall',
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
      label: 'Kvantitetstyp',
      render: (item) => (
        <Badge variant="outline">
          {item.quantityType === 'UNIT'
            ? 'Styck'
            : item.quantityType === 'METER'
              ? 'Meter'
              : item.quantityType === 'SQUARE_METER'
                ? 'Kvm'
                : 'Kbm'}
        </Badge>
      ),
    },
  ]

  return (
    <DataTable
      data={subtypes}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      emptyMessage="Inga undertyper ännu"
    />
  )
}
