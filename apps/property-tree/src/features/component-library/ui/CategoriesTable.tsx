import type { ComponentCategory } from '@/services/types'

import { COMPONENT_CATEGORY_TYPE_LABELS } from '@/shared/lib/componentLabels'
import { sortBySwedishName } from '@/shared/lib/sortByName'
import { type Column, DataTable } from '@/shared/ui/DataTable'

interface CategoriesTableProps {
  categories: ComponentCategory[]
  isLoading: boolean
  onEdit: (category: ComponentCategory) => void
  onDelete: (category: ComponentCategory) => void
  onNavigate: (category: ComponentCategory) => void
  getHref: (category: ComponentCategory) => string
}

export const CategoriesTable = ({
  categories,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
  getHref,
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
      isEmpty: (item) =>
        !item.description || item.description === item.categoryName,
      render: (item) => (
        <span className="text-muted-foreground">{item.description || '-'}</span>
      ),
    },
    {
      key: 'type',
      label: 'Kategorityp',
      render: (item) => (
        <span className="text-muted-foreground">
          {item.type ? COMPONENT_CATEGORY_TYPE_LABELS[item.type] : '-'}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      data={sortBySwedishName(categories, (item) => item.categoryName)}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      getRowHref={getHref}
      pageSize={50}
      emptyMessage="Inga kategorier"
      getRowLabel={(item) => item.categoryName}
    />
  )
}
