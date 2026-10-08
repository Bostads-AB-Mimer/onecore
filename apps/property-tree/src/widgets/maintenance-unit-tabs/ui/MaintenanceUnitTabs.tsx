import type { ReactNode } from 'react'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'

import { SpaceComponents } from '@/features/component-library'
import { WorkOrdersTabContent } from '@/features/work-orders'

import type { MaintenanceUnit } from '@/services/types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'

import {
  MAINTENANCE_UNIT_DEFAULT_TAB,
  MAINTENANCE_UNIT_TABS,
  type MaintenanceUnitTab,
} from '../model/tabs'
import { MaintenanceUnitTabsMobile } from './MaintenanceUnitTabsMobile'

interface MaintenanceUnitTabsProps {
  maintenanceUnit: MaintenanceUnit
}

export function MaintenanceUnitTabs({
  maintenanceUnit,
}: MaintenanceUnitTabsProps) {
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(
    MAINTENANCE_UNIT_TABS,
    MAINTENANCE_UNIT_DEFAULT_TAB
  )

  if (isMobile) {
    return <MaintenanceUnitTabsMobile maintenanceUnit={maintenanceUnit} />
  }

  const content: Record<MaintenanceUnitTab, ReactNode> = {
    komponenter: (
      <SpaceComponents
        spaceId={maintenanceUnit.propertyObjectId}
        spaceName={
          maintenanceUnit.caption ||
          maintenanceUnit.code ||
          `Serviceenhet: ${maintenanceUnit.id}`
        }
      />
    ),
    besiktningar: null,
    arenden: (
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
  }

  return (
    <div className="w-full">
      <SegmentedTabs
        tabs={MAINTENANCE_UNIT_TABS}
        value={value}
        basePath={basePath}
        className="mb-4"
      />
      {content[value]}
    </div>
  )
}
