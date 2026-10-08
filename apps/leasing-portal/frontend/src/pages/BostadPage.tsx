import { SegmentedTabs, useRouteTab } from '@onecore/ui'

const BOSTAD_TABS = [
  { value: 'publicera', label: 'Publicera' },
  { value: 'publicerat-nu', label: 'Publicerat nu' },
  { value: 'erbjud-visning', label: 'Erbjud visning' },
  { value: 'visning', label: 'Visning' },
  { value: 'erbjud-kontrakt', label: 'Erbjud kontrakt' },
  { value: 'historik', label: 'Historik' },
] as const

export function BostadPage() {
  const { value, basePath } = useRouteTab(BOSTAD_TABS, 'publicera')

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Bostad</h1>
      <SegmentedTabs tabs={BOSTAD_TABS} value={value} basePath={basePath} />
      <p className="py-8 text-center text-muted-foreground">
        Inget innehåll ännu
      </p>
    </div>
  )
}
