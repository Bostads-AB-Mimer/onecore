import { Card, CardContent, CardHeader, CardTitle } from '../ui/v2/Card'
import type { Component } from '@/services/types'

interface ComponentCardProps {
  component: Component
}

export const ComponentCard = ({ component }: ComponentCardProps) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{component.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {component.classification.category.name}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Komponenttyp:</span>
            <span className="font-medium">
              {component.classification.componentType.name || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fabrikat:</span>
            <span className="font-medium">
              {component.details.manufacturer || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Typbeteckning:</span>
            <span className="font-medium">
              {component.details.typeDesignation || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Installationsdatum:</span>
            <span className="font-medium">
              {formatDate(component.dates.installation)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Garanti t.o.m:</span>
            <span className="font-medium">
              {formatDate(component.dates.warrantyEnd)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
