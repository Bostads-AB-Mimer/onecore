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
  /** Callback when edit action is clicked */
  onEdit?: () => void
  /** Callback when delete action is clicked */
  onDelete?: () => void
  /** Custom label for edit action */
  editLabel?: string
  /** Custom label for delete action */
  deleteLabel?: string
  /** Additional menu items to render before edit/delete */
  extraItems?: React.ReactNode
  /** Additional menu items to render after edit/delete */
  extraItemsAfter?: React.ReactNode
}

/**
 * A dropdown menu for table row actions (Edit, Delete, etc.).
 * Provides a consistent action menu pattern across all tables.
 *
 * @example
 * ```tsx
 * <ActionMenu
 *   onEdit={() => onEdit(item)}
 *   onDelete={() => onDelete(item.id)}
 * />
 *
 * // With extra items:
 * <ActionMenu
 *   onEdit={() => onEdit(item)}
 *   extraItems={
 *     <DropdownMenuItem onClick={() => onDownload(item)}>
 *       <Download className="h-4 w-4 mr-2" />
 *       Ladda ner
 *     </DropdownMenuItem>
 *   }
 * />
 * ```
 */
export function ActionMenu({
  onEdit,
  onDelete,
  editLabel = 'Redigera',
  deleteLabel = 'Ta bort',
  extraItems,
  extraItemsAfter,
}: ActionMenuProps) {
  // Don't render if no actions are provided
  if (!onEdit && !onDelete && !extraItems && !extraItemsAfter) {
    return null
  }

  return (
    <DropdownMenu>
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
