import { NavigationItem } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { StaircaseItems } from './StaircaseItems'

interface BuildingItemsProps {
  buildings: NavigationItem[]
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function BuildingItems({ buildings, expanded, selected, onExpand, onSelect }: BuildingItemsProps) {
  return buildings.map(item => (
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton
        onClick={() => {
          onExpand(item)
          onSelect(item)
        }}
        isActive={selected === item.id}
      >
        <Warehouse />
        <span>{item.name}</span>
      </SidebarMenuButton>
      {expanded.has(item.id) && item.children && (
        <SidebarMenu>
          {item.children.map(staircase => (
            <StaircaseItems
              key={staircase.id}
              staircases={[staircase]}
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
