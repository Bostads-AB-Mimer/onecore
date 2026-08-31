export interface SidebarContext {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

export interface SidebarProviderProps extends React.ComponentProps<'div'> {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface SidebarProps extends React.ComponentProps<'div'> {
  side?: 'left' | 'right'
  variant?: 'sidebar' | 'floating' | 'inset'
  collapsible?: 'offcanvas' | 'icon' | 'none'
}

export interface SidebarMenuButtonProps extends React.ComponentProps<'button'> {
  asChild?: boolean
  isActive?: boolean
  isSelectedInHierarchy?: boolean
  tooltip?: string | React.ComponentProps<any>
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}
