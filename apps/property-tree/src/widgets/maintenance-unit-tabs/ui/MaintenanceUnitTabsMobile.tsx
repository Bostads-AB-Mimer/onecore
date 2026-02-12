import { ClipboardList, MessageSquare, Wrench } from 'lucide-react'

import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'
import type { MaintenanceUnit } from '@/services/types'
import { ContextType } from '@/shared/types/ui'

import { SpaceComponents } from '@/features/component-library'
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
        <SpaceComponents
          spaceId={maintenanceUnit.propertyObjectId}
          spaceName={
            maintenanceUnit.caption ||
            maintenanceUnit.code ||
            `Serviceenhet: ${maintenanceUnit.id}`
          }
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
