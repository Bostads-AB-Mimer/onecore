import { NavigationItem } from '@/services/types'
import { Home } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { ResidenceItems } from './ResidenceItems'

interface StaircaseItemsProps {
  staircases: NavigationItem[]
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function StaircaseItems({ staircases, expanded, selected, onExpand, onSelect }: StaircaseItemsProps) {
  return staircases.map(item => (
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton
        onClick={() => {
          onExpand(item)
          onSelect(item)
        }}
        isActive={selected === item.id}
      >
        <Home />
        <span>{item.name}</span>
      </SidebarMenuButton>
      {expanded.has(item.id) && item.children && (
        <SidebarMenu>
          {item.children.map(residence => (
            <ResidenceItems
              key={residence.id}
              residences={[residence]}
              expanded={expanded}
              selected={selected}
              onExpand={onExpand}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  ))
}
