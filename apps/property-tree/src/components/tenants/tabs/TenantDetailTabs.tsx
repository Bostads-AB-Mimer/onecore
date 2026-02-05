import { parseAsString, useQueryState } from 'nuqs'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v2/Tabs'

interface TenantDetailTabsProps {
  children: React.ReactNode
  hasActiveCases?: boolean
}

export const TenantDetailTabs = ({ children }: TenantDetailTabsProps) => {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsString.withDefault('contracts')
  )

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        <TabsTrigger value="contracts">Hyreskontrakt</TabsTrigger>
        <TabsTrigger value="queue">Uthyrning</TabsTrigger>
        <TabsTrigger value="work-orders">Ärenden</TabsTrigger>
        <TabsTrigger value="ledger">Fakturor & betalningar</TabsTrigger>
        <TabsTrigger value="notes">Noteringar</TabsTrigger>
        <TabsTrigger value="keys">Nyckellån</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}
