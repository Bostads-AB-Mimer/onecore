import { Card, CardContent, CardHeader } from '../ui/v2/Card'
import { Button } from '../ui/v2/Button'
import { ChevronRight, Edit, Trash2 } from 'lucide-react'
import type { ComponentSubtype } from '@/services/types'

interface SubtypeCardProps {
  subtype: ComponentSubtype
  onEdit: () => void
  onDelete: () => void
  onNavigate?: () => void
}

export const SubtypeCard = ({
  subtype,
  onEdit,
  onDelete,
  onNavigate,
}: SubtypeCardProps) => {
  const formatQuantityType = (type: string) => {
    const labels: Record<string, string> = {
      UNIT: 'Enhet',
      METER: 'Meter',
      SQUARE_METER: 'Kvadratmeter',
      CUBIC_METER: 'Kubikmeter',
    }
    return labels[type] || type
  }

  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold break-words">{subtype.subTypeName}</h3>
            {subtype.xpandCode && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-secondary text-xs rounded break-all">
                {subtype.xpandCode}
              </span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              title="Redigera undertyp"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title="Ta bort undertyp"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground text-xs sm:text-sm">Avskrivningspris:</span>
            <span className="font-medium break-words">
              {subtype.depreciationPrice} kr
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground text-xs sm:text-sm">Kvantitetstyp:</span>
            <span className="font-medium break-words">
              {formatQuantityType(subtype.quantityType)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground text-xs sm:text-sm">Teknisk livslängd:</span>
            <span className="font-medium break-words">
              {subtype.technicalLifespan} år
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground text-xs sm:text-sm">Ekonomisk livslängd:</span>
            <span className="font-medium break-words">
              {subtype.economicLifespan} år
            </span>
          </div>
          <div className="flex justify-between gap-2 sm:col-span-2">
            <span className="text-muted-foreground text-xs sm:text-sm">Underhållsintervall:</span>
            <span className="font-medium break-words">
              {subtype.replacementIntervalMonths} månader
            </span>
          </div>
        </div>

        {onNavigate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigate}
            className="w-full"
          >
            Visa modeller
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
