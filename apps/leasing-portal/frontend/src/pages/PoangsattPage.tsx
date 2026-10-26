import { SegmentedTabs, useRouteTab } from '@onecore/ui'

import { POANGSATT_TABS } from './poangsatt/stages'

export function PoangsattPage() {
  const { value, basePath } = useRouteTab(POANGSATT_TABS, 'publicerat-nu')

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Poängsatt</h1>
      <SegmentedTabs tabs={POANGSATT_TABS} value={value} basePath={basePath} />
      <p className="py-8 text-center text-muted-foreground">
        Inget innehåll ännu
      </p>
    </div>
  )
}
