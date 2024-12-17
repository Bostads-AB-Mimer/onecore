import { NavigationItem } from '@/services/types'
import { Building } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { BuildingItems } from './BuildingItems'

interface PropertyItemsProps {
  properties: NavigationItem[]
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function PropertyItems({ properties, expanded, selected, onExpand, onSelect }: PropertyItemsProps) {
  return properties.map(item => (
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton
        onClick={() => {
          onExpand(item)
          onSelect(item)
        }}
        isActive={selected === item.id}
      >
        <Building />
        <span>{item.name}</span>
      </SidebarMenuButton>
      {expanded.has(item.id) && item.children && (
        <SidebarMenu>
          {item.children.map(building => (
            <BuildingItems 
              key={building.id}
              buildings={[building]}
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
