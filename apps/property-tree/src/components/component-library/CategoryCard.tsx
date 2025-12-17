import { Card, CardContent, CardHeader } from '../ui/v2/Card'
import { Button } from '../ui/v2/Button'
import { ChevronRight, Edit, Trash2 } from 'lucide-react'
import type { ComponentCategory } from '@/services/types'

interface CategoryCardProps {
  category: ComponentCategory
  onEdit: () => void
  onDelete: () => void
  onNavigate: () => void
}

export const CategoryCard = ({
  category,
  onEdit,
  onDelete,
  onNavigate,
}: CategoryCardProps) => {
  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
            <h3 className="text-base font-semibold hover:text-primary transition-colors break-words">
              {category.categoryName}
            </h3>
            {category.description && (
              <p className="text-sm text-muted-foreground mt-1 break-words">
                {category.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              title="Redigera kategori"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="Ta bort kategori"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigate}
          className="w-full"
        >
          Visa typer
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}
