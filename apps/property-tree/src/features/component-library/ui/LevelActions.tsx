import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'

interface LevelActionsProps {
  label: string
  onEdit: () => void
  onDelete: () => void
}

export const LevelActions = ({
  label,
  onEdit,
  onDelete,
}: LevelActionsProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label={`Åtgärder för ${label}`}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem onClick={onEdit}>
        <Edit className="h-4 w-4 mr-2" />
        Redigera
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Ta bort
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)
