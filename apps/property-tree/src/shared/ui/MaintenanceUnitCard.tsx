import { Card, CardContent } from '@/shared/ui/Card'
import { Separator } from '@/shared/ui/Separator'

import { MaintenanceSubComponent } from './MaintenanceSubComponent'

interface SubComponent {
  name: string
  specs: {
    ekonomiskLivslangd: string
    tekniskLivslangd: string
    year: string
    quantity: string
    brand: string
    model: string
  }
}

interface MaintenanceUnitCardProps {
  subComponents: SubComponent[]
}

export const MaintenanceUnitCard = ({
  subComponents,
}: MaintenanceUnitCardProps) => {
  // Use the first component's name as the card title, or fallback to "Underhållsenhet"
  const cardTitle =
    subComponents.length > 0 ? subComponents[0].name : 'Underhållsenhet'

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      <h3 className="font-semibold text-base sm:text-lg">{cardTitle}</h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Årsintervall:</span>
          <span>2020-2025</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Avskrivningstid:</span>
          <span>25 år</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Fabrikat:</span>
          <span>Takab AB</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Garantitid:</span>
          <span>10 år</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Yta:</span>
          <span>450 m²</span>
        </div>

        <Separator className="my-2" />

        <div className="space-y-3">
          {subComponents.map((component, idx) => (
            <MaintenanceSubComponent
              key={idx}
              name={component.name}
              specs={component.specs}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
