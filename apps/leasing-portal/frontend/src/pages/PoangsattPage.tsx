import { SegmentedTabs, useRouteTab } from '@onecore/ui'

// The queue-based (poängsatt) letting process, one tab per stage after publishing.
const POANGSATT_TABS = [
  { value: 'publicerat-nu', label: 'Publicerat nu' },
  { value: 'erbjud-visning', label: 'Erbjud visning' },
  { value: 'visning', label: 'Visning' },
  { value: 'erbjud-kontrakt', label: 'Erbjud kontrakt' },
  { value: 'historik', label: 'Historik' },
] as const

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
