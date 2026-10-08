import { useRouteTab } from '@onecore/ui'
import { ClipboardList, MessageSquare, Wrench } from 'lucide-react'

import { SpaceComponents } from '@/features/component-library'
import { WorkOrdersTabContent } from '@/features/work-orders'

import type { MaintenanceUnit } from '@/services/types'

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import {
  MAINTENANCE_UNIT_DEFAULT_TAB,
  MAINTENANCE_UNIT_TABS,
} from '../model/tabs'

interface MaintenanceUnitTabsMobileProps {
  maintenanceUnit: MaintenanceUnit
}

export function MaintenanceUnitTabsMobile({
  maintenanceUnit,
}: MaintenanceUnitTabsMobileProps) {
  const { value } = useRouteTab(
    MAINTENANCE_UNIT_TABS,
    MAINTENANCE_UNIT_DEFAULT_TAB
  )
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'komponenter',
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
      id: 'besiktningar',
      icon: ClipboardList,
      title: 'Besiktningar',
      disabled: true,
      content: null,
    },
    {
      id: 'arenden',
      icon: MessageSquare,
      title: 'Ärenden',
      content: (
        <WorkOrdersTabContent
          contextType={ContextType.MaintenanceUnit}
          id={maintenanceUnit.code}
          metadata={{
            propertyName: maintenanceUnit.estate || '',
            type: maintenanceUnit.type || '',
            code: maintenanceUnit.code,
          }}
        />
      ),
    },
  ].filter((item) => item.content !== null)

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={[value]}
      className="space-y-3"
    />
  )
}
