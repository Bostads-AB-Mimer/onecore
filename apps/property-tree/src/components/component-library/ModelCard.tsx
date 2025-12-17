import { Card, CardContent, CardHeader } from '../ui/v2/Card'
import { Button } from '../ui/v2/Button'
import { Edit, Trash2, Plus } from 'lucide-react'
import type { ComponentModel } from '@/services/types'

interface ModelCardProps {
  model: ComponentModel
  onEdit: () => void
  onDelete: () => void
  onCreateInstance: () => void
}

export const ModelCard = ({
  model,
  onEdit,
  onDelete,
  onCreateInstance,
}: ModelCardProps) => {
  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold break-words">{model.modelName}</h3>
            <p className="text-sm text-muted-foreground break-words">
              {model.manufacturer}
            </p>
            {model.coclassCode && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-secondary text-xs rounded break-all">
                {model.coclassCode}
              </span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              title="Redigera modell"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title="Ta bort modell"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Pris:</span>
            <span className="font-medium break-words">{model.currentPrice} kr</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground text-xs sm:text-sm">Installationspris:</span>
            <span className="font-medium break-words">
              {model.currentInstallPrice} kr
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Garanti:</span>
            <span className="font-medium break-words">{model.warrantyMonths} mån</span>
          </div>
          {model.dimensions && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Mått:</span>
              <span className="font-medium break-words">{model.dimensions}</span>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onCreateInstance}
          className="w-full"
        >
          Skapa instans
          <Plus className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}
