// Re-exports from the sidebar module
export { SidebarProvider, useSidebar } from '../sidebar/context'
export {
  Sidebar,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  SidebarInput,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarContent,
} from '../sidebar/components'
export {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '../sidebar/menu'

// Export types for external use
export type {
  SidebarContext,
  SidebarProviderProps,
  SidebarProps,
  SidebarMenuButtonProps,
} from '../sidebar/types'
