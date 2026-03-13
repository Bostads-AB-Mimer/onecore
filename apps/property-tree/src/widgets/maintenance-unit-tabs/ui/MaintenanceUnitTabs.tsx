import { ClipboardList, MessageSquare, Wrench } from 'lucide-react'

import { SpaceComponents } from '@/features/component-library'
import { WorkOrdersTabContent } from '@/features/work-orders'

import type { MaintenanceUnit } from '@/services/types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import { MaintenanceUnitTabsMobile } from './MaintenanceUnitTabsMobile'

interface MaintenanceUnitTabsProps {
  maintenanceUnit: MaintenanceUnit
}

export function MaintenanceUnitTabs({
  maintenanceUnit,
}: MaintenanceUnitTabsProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MaintenanceUnitTabsMobile maintenanceUnit={maintenanceUnit} />
  }

  return (
    <Tabs defaultValue="workorders" className="w-full">
      <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
        <TabsTrigger value="components" className="flex items-center gap-1.5">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Komponenter</span>
        </TabsTrigger>
        <TabsTrigger
          value="inspections"
          className="flex items-center gap-1.5"
          disabled
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Besiktningar</span>
        </TabsTrigger>
        <TabsTrigger value="workorders" className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Ärenden</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="components">
        <SpaceComponents
          spaceId={maintenanceUnit.propertyObjectId}
          spaceName={
            maintenanceUnit.caption ||
            maintenanceUnit.code ||
            `Serviceenhet: ${maintenanceUnit.id}`
          }
        />
      </TabsContent>

      <TabsContent value="workorders">
        <WorkOrdersTabContent
          contextType={ContextType.MaintenanceUnit}
          id={maintenanceUnit.code}
        />
      </TabsContent>
    </Tabs>
  )
}
