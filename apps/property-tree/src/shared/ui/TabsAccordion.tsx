import type { ReactNode } from 'react'
import type { SegmentedTab } from '@onecore/ui'

import { MobileAccordion, type MobileAccordionItem } from './MobileAccordion'

interface TabsAccordionProps<T extends string> {
  tabs: readonly (SegmentedTab & { value: T })[]
  /** Same record the desktop tab bar renders from; falsy entries are skipped. */
  content: Record<T, ReactNode>
  /** Tab to open on load, normally the one resolved from the URL. */
  open: T
  className?: string
}

/** Mobile rendering of a tabbed page: the tab list as an accordion. */
export function TabsAccordion<T extends string>({
  tabs,
  content,
  open,
  className = 'space-y-3',
}: TabsAccordionProps<T>) {
  const items: MobileAccordionItem[] = tabs
    .filter((tab) => !tab.disabled && Boolean(content[tab.value]))
    .map((tab) => ({
      id: tab.value,
      title: tab.label,
      icon: tab.icon,
      content: content[tab.value],
    }))

  return (
    <MobileAccordion items={items} defaultOpen={[open]} className={className} />
  )
}
