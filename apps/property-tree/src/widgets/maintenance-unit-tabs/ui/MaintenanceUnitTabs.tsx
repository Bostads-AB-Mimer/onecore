import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import { ClipboardList, MessageSquare, Wrench } from 'lucide-react'

import { useIsMobile } from '@/hooks/useMobile'
import type { MaintenanceUnit } from '@/services/types'
import { ContextType } from '@/types/ui'

import { MaintenanceUnitComponents } from '@/features/maintenance-units'
import { WorkOrdersTabContent } from '@/features/work-orders'

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
        <MaintenanceUnitComponents
          propertyObjectId={maintenanceUnit.propertyObjectId}
          maintenanceUnitName={maintenanceUnit.caption || maintenanceUnit.code}
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
