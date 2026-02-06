import React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'

export interface ActionMenuProps {
  onEdit?: () => void
  onDelete?: () => void
  editLabel?: string
  deleteLabel?: string
  extraItems?: React.ReactNode
  extraItemsAfter?: React.ReactNode
}

/** Dropdown menu for table row actions (Edit, Delete, etc.) */
export function ActionMenu({
  onEdit,
  onDelete,
  editLabel = 'Redigera',
  deleteLabel = 'Ta bort',
  extraItems,
  extraItemsAfter,
}: ActionMenuProps) {
  if (!onEdit && !onDelete && !extraItems && !extraItemsAfter) {
    return null
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {extraItems}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            {editLabel}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleteLabel}
          </DropdownMenuItem>
        )}
        {extraItemsAfter}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
