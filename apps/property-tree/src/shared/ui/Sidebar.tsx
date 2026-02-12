// Re-exports from the sidebar module
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from './sidebar/components'
export { SidebarProvider, useSidebar } from './sidebar/context'
export {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from './sidebar/menu'

// Export types for external use
export type {
  SidebarContext,
  SidebarMenuButtonProps,
  SidebarProps,
  SidebarProviderProps,
} from './sidebar/types'
