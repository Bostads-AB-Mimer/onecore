import { NavigationItem } from '@/services/types'
import { Building2 } from 'lucide-react'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'
import { PropertyItems } from './PropertyItems'

interface CompanyNavigationProps {
  item: NavigationItem
  expanded: Set<string>
  selected: string | null
  onExpand: (item: NavigationItem) => void
  onSelect: (item: NavigationItem) => void
}

export function CompanyNavigation({ item, expanded, selected, onExpand, onSelect }: CompanyNavigationProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          onExpand(item)
          onSelect(item)
        }}
        isActive={selected === item.id}
      >
        <Building2 />
        <span>{item.name}</span>
      </SidebarMenuButton>
      {expanded.has(item.id) && item.children && (
        <SidebarMenu>
          <PropertyItems
            properties={item.children}
            expanded={expanded}
            selected={selected}
            onExpand={onExpand}
            onSelect={onSelect}
          />
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}
