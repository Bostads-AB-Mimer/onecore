import { TabLayout } from '@/components/ui/TabLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import { Wrench, FilePlus } from 'lucide-react'
import type { PropertyDetail } from '@/types/api'
import { useMaintenanceUnits } from '@/components/hooks/useMaintenanceUnits'

interface PropertyMaintenanceUnitsTabProps {
  propertyDetail: PropertyDetail
}

// All maintenance unit types to display (in order)
const MAINTENANCE_UNIT_TYPES = [
  {
    label: 'Parkeringsområde',
    description: 'Utomhusparkering för hyresgäster',
  },
  {
    label: 'Lekplats',
    description: 'Lekplats med gungor och klätterställning',
  },
  {
    label: 'Rekreationsytor',
    description: 'Gemensam rekreationsyta för hyresgäster',
  },
  {
    label: 'Återvinning',
    description: 'Sorterat avfall och återvinning',
  },
  {
    label: 'Tvättstugor',
    description: 'Tvätt och torkmaskiner för hyresgäster',
  },
  { label: 'Skyddsrum', description: 'Skyddsrum enligt BBR' },
  { label: 'Förråd', description: 'Förrådsutrymmen för hyresgäster' },
  {
    label: 'Installation',
    description: 'Ventilationsaggregat och värmesystem',
  },
  { label: 'Lås & passage', description: 'Elektroniska lås och passagesystem' },
] as const

// Type mapping for API data to display categories
const TYPE_CONFIG: Record<string, string> = {
  Tvättstuga: 'Tvättstugor',
  Miljöbod: 'Återvinning',
  Sopskåp: 'Återvinning',
  Skyddsrum: 'Skyddsrum',
  Lekplats: 'Lekplats',
  'Undercentral Värme': 'Installation',
  'Undercentral Ventilation': 'Installation',
  'Undercentral Data/IT': 'Installation',
  'Lås & passage': 'Lås & passage',
}

export const PropertyMaintenanceUnitsTab = ({
  propertyDetail,
}: PropertyMaintenanceUnitsTabProps) => {
  const { maintenanceUnits, isLoading, error } = useMaintenanceUnits(
    propertyDetail.code
  )

  if (isLoading) {
    return (
      <TabLayout title="Underhållsenheter" showCard={true}>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-200 rounded"></div>
          <div className="h-12 bg-slate-200 rounded"></div>
          <div className="h-12 bg-slate-200 rounded"></div>
        </div>
      </TabLayout>
    )
  }

  if (error) {
    return (
      <TabLayout title="Underhållsenheter" showCard={true}>
        <div className="text-red-500 p-4 bg-red-50 rounded-lg">
          <p className="font-medium">Kunde inte ladda underhållsenheter</p>
          <p className="text-sm mt-1">
            {error instanceof Error ? error.message : 'Ett fel uppstod'}
          </p>
        </div>
      </TabLayout>
    )
  }

  const mappedCount = maintenanceUnits.filter(
    (unit) => unit.type && TYPE_CONFIG[unit.type]
  ).length

  if (mappedCount === 0) {
    return (
      <TabLayout title="Underhållsenheter" count={0}>
        <EmptyState
          icon={Wrench}
          title="Inga underhållsenheter"
          description="Det finns inga underhållsenheter registrerade för denna fastighet ännu."
        />
      </TabLayout>
    )
  }

  return (
    <TabLayout title="Underhållsenheter" count={mappedCount} showCard={true}>
      <Accordion type="single" collapsible className="space-y-3">
        {MAINTENANCE_UNIT_TYPES.map((unitType) => {
          // Filter units where the mapped API type matches this category label
          const units = maintenanceUnits.filter(
            (unit) => unit.type && TYPE_CONFIG[unit.type] === unitType.label
          )
          const unitCount = units.length

          return (
            <AccordionItem
              key={unitType.label}
              value={unitType.label}
              className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline hover:bg-slate-50/50 transition-colors px-4">
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {unitType.label}
                    </span>
                    {unitCount > 0 && (
                      <span className="text-sm text-slate-500 font-normal">
                        ({unitCount})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {unitType.description}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-4">
                <div className="space-y-4 px-3 sm:px-4">
                  {unitCount > 0 ? (
                    <div className="space-y-2">
                      {units.map((unit) => (
                        <div
                          key={unit.id}
                          className="p-3 bg-background rounded-lg border border-slate-200"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm mb-2">
                                {unit.caption}
                              </h4>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>
                                  <span className="font-medium">Kod:</span>{' '}
                                  {unit.code}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="opacity-50 cursor-not-allowed shrink-0"
                              title="Funktionalitet kommer snart"
                            >
                              <FilePlus className="h-4 w-4 mr-2" />
                              Skapa ärende
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-sm">
                        Innehåll kommer att läggas till senare
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </TabLayout>
  )
}
