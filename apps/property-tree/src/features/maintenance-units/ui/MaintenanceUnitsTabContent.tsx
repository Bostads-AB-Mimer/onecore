import { Link } from 'react-router-dom'
import { ChevronRight, FilePlus, Wrench } from 'lucide-react'

import type { MaintenanceUnit } from '@/services/types'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { MAINTENANCE_UNIT_TYPES, TYPE_CONFIG } from '../constants'
import {
  type MaintenanceUnitsContextType,
  useMaintenanceUnits,
} from '../hooks/useMaintenanceUnits'

interface MaintenanceUnitsTabContentProps {
  contextType: MaintenanceUnitsContextType
  identifier: string | undefined
  /** If true, shows a flat list of units without category accordions. Default: false */
  showFlatList?: boolean
}

// Reusable component for rendering a single maintenance unit item
const MaintenanceUnitItem = ({ unit }: { unit: MaintenanceUnit }) => (
  <Link
    to={`/maintenance-units/${unit.code}`}
    className="block p-3 bg-background rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
  >
    <div className="flex justify-between items-start gap-2">
      <div className="flex-1">
        <h4 className="font-medium text-sm mb-2">{unit.caption}</h4>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Kod:</span> {unit.code}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          disabled
          className="opacity-50 cursor-not-allowed"
          title="Funktionalitet kommer snart"
          onClick={(e) => e.preventDefault()}
        >
          <FilePlus className="h-4 w-4 mr-2" />
          Skapa ärende
        </Button>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
    </div>
  </Link>
)

export const MaintenanceUnitsTabContent = ({
  contextType,
  identifier,
  showFlatList = false,
}: MaintenanceUnitsTabContentProps) => {
  const { maintenanceUnits, isLoading, error } = useMaintenanceUnits({
    contextType,
    identifier,
  })

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
          description="Det finns inga underhållsenheter registrerade ännu."
        />
      </TabLayout>
    )
  }

  // Filter to only mapped units for flat list
  const mappedUnits = maintenanceUnits.filter(
    (unit) => unit.type && TYPE_CONFIG[unit.type]
  )

  // Flat list view - just show units directly without categories
  if (showFlatList) {
    return (
      <TabLayout title="Underhållsenheter" count={mappedCount} showCard={true}>
        <div className="space-y-2">
          {mappedUnits.map((unit) => (
            <MaintenanceUnitItem key={unit.id} unit={unit} />
          ))}
        </div>
      </TabLayout>
    )
  }

  // Category accordion view
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
                        <MaintenanceUnitItem key={unit.id} unit={unit} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-sm">
                        Inga underhållsenheter i denna kategori
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
