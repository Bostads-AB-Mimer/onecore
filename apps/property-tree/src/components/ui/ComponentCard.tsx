import { Card, CardContent } from '@/components/ui/v2/Card'
import { Separator } from '@/components/ui/Separator'

interface ComponentSpec {
  label: string
  value: string
}

interface ComponentCardProps {
  title: string
  description?: string
  specs?: ComponentSpec[]
  type?: string
  location?: string
}

export const ComponentCard = ({
  title,
  description,
  specs = [],
  type,
  location,
}: ComponentCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
        </div>

        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        {(type || location) && (
          <>
            <Separator />
            <div className="space-y-2 text-sm">
              {type && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Typ:</span>
                  <span>{type}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Placering:</span>
                  <span>{location}</span>
                </div>
              )}
            </div>
          </>
        )}

        {specs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {specs.map((spec, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{spec.label}:</span>
                  <span>{spec.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
