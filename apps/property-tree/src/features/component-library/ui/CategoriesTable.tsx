import type { ComponentCategory } from '@/services/types'

import { COMPONENT_CATEGORY_TYPE_LABELS } from '@/shared/lib/componentLabels'
import { type Column, DataTable } from '@/shared/ui/DataTable'

interface CategoriesTableProps {
  categories: ComponentCategory[]
  isLoading: boolean
  onEdit: (category: ComponentCategory) => void
  onDelete: (category: ComponentCategory) => void
  onNavigate: (category: ComponentCategory) => void
}

export const CategoriesTable = ({
  categories,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
}: CategoriesTableProps) => {
  const columns: Column<ComponentCategory>[] = [
    {
      key: 'name',
      label: 'Namn',
      render: (item) => <div className="font-medium">{item.categoryName}</div>,
    },
    {
      key: 'description',
      label: 'Beskrivning',
      render: (item) => (
        <span className="text-muted-foreground">{item.description || '-'}</span>
      ),
    },
    {
      key: 'type',
      label: 'Sort',
      render: (item) => (
        <span className="text-muted-foreground">
          {item.type ? COMPONENT_CATEGORY_TYPE_LABELS[item.type] : '-'}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      data={categories}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      emptyMessage="Inga kategorier ännu"
    />
  )
}
