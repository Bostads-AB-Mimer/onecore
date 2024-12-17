import { NavigationItem } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface ResidenceItemsProps {
  residences: NavigationItem[]
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function ResidenceItems({ residences, expanded: _, selected, onExpand, onSelect }: ResidenceItemsProps) {
  return residences.map(item => (
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton
        onClick={() => {
          onExpand(item)
          onSelect(item)
        }}
        isActive={selected === item.id}
      >
        <Hotel />
        <span>{item.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ))
}
