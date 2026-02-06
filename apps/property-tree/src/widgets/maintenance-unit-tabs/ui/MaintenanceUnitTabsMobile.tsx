import { ClipboardList, MessageSquare, Wrench } from 'lucide-react'

import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import type { MaintenanceUnit } from '@/services/types'
import { ContextType } from '@/types/ui'

import { MaintenanceUnitComponents } from '@/features/maintenance-units'
import { WorkOrdersTabContent } from '@/features/work-orders'

interface MaintenanceUnitTabsMobileProps {
  maintenanceUnit: MaintenanceUnit
}

export function MaintenanceUnitTabsMobile({
  maintenanceUnit,
}: MaintenanceUnitTabsMobileProps) {
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'components',
      icon: Wrench,
      title: 'Komponenter',
      content: (
        <MaintenanceUnitComponents
          propertyObjectId={maintenanceUnit.propertyObjectId}
          maintenanceUnitName={maintenanceUnit.caption || maintenanceUnit.code}
        />
      ),
    },
    {
      id: 'inspections',
      icon: ClipboardList,
      title: 'Besiktningar',
      disabled: true,
      content: null,
    },
    {
      id: 'work-orders',
      icon: MessageSquare,
      title: 'Ärenden',
      content: (
        <WorkOrdersTabContent
          contextType={ContextType.MaintenanceUnit}
          id={maintenanceUnit.code}
        />
      ),
    },
  ].filter((item) => item.content !== null)

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['work-orders']}
      className="space-y-3"
    />
  )
}
