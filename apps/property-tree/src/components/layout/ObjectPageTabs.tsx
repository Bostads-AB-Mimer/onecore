import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/v2/Tabs'

export interface TabConfig {
  value: string
  label: string
  icon: LucideIcon
  content?: ReactNode
  disabled?: boolean
}

interface ObjectPageTabsProps {
  defaultTab: string
  tabs: TabConfig[]
}

export const ObjectPageTabs = ({ defaultTab, tabs }: ObjectPageTabsProps) => {
  return (
    <div className="lg:col-span-3 space-y-6">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled}
              className="flex items-center gap-1.5"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
