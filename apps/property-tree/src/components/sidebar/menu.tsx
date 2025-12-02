import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/Tooltip'

import { useSidebar } from './context'
import { SidebarMenuButtonProps } from './types'
import { sidebarMenuButtonVariants } from './variants'

// Helper for creating forwarded components
function createForwardedComponent<
  T extends React.ElementType,
  P extends object = {},
>(
  displayName: string,
  render: React.ForwardRefRenderFunction<
    React.ElementRef<T>,
    React.PropsWithoutRef<React.ComponentProps<T> & P>
  >
) {
  const Component = React.forwardRef(render)
  Component.displayName = displayName
  return Component
}

// Group components
export const SidebarGroup = createForwardedComponent<'div'>(
  'SidebarGroup',
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  )
)

export const SidebarGroupLabel = createForwardedComponent<
  'div',
  { asChild?: boolean }
>('SidebarGroupLabel', ({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        [
          'duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium',
          'text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear',
          'focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
          'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        ].join(' '),
        className
      )}
      {...props}
    />
  )
})

export const SidebarGroupAction = createForwardedComponent<
  'button',
  { asChild?: boolean }
>('SidebarGroupAction', ({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        [
          'absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0',
          'text-sidebar-foreground outline-none ring-sidebar-ring transition-transform',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2',
          '[&>svg]:size-4 [&>svg]:shrink-0',
          'after:absolute after:-inset-2 after:md:hidden',
          'group-data-[collapsible=icon]:hidden',
        ].join(' '),
        className
      )}
      {...props}
    />
  )
})

export const SidebarGroupContent = createForwardedComponent<'div'>(
  'SidebarGroupContent',
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  )
)

// Menu components
export const SidebarMenu = createForwardedComponent<'ul'>(
  'SidebarMenu',
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  )
)

export const SidebarMenuItem = createForwardedComponent<'li'>(
  'SidebarMenuItem',
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
)

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(
  (
    {
      asChild = false,
      isActive = false,
      isSelectedInHierarchy = false,
      variant = 'default',
      size = 'default',
      tooltip,
      className,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const { isMobile, state } = useSidebar()

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        data-selected-in-hierarchy={isSelectedInHierarchy}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    const tooltipProps =
      typeof tooltip === 'string' ? { children: tooltip } : tooltip

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== 'collapsed' || isMobile}
          {...tooltipProps}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = 'SidebarMenuButton'

export const SidebarMenuAction = createForwardedComponent<
  'button',
  { asChild?: boolean; showOnHover?: boolean }
>(
  'SidebarMenuAction',
  ({ className, asChild = false, showOnHover = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        data-sidebar="menu-action"
        className={cn(
          [
            'absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0',
            'text-sidebar-foreground outline-none ring-sidebar-ring transition-transform',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2',
            'peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0',
            'after:absolute after:-inset-2 after:md:hidden',
            'peer-data-[size=sm]/menu-button:top-1',
            'peer-data-[size=default]/menu-button:top-1.5',
            'peer-data-[size=lg]/menu-button:top-2.5',
            'group-data-[collapsible=icon]:hidden',
            showOnHover &&
              [
                'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100',
                'data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
                'md:opacity-0',
              ].join(' '),
          ].join(' '),
          className
        )}
        {...props}
      />
    )
  }
)

export const SidebarMenuBadge = createForwardedComponent<'div'>(
  'SidebarMenuBadge',
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="menu-badge"
      className={cn(
        [
          'absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1',
          'text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none',
          'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
          'peer-data-[size=sm]/menu-button:top-1',
          'peer-data-[size=default]/menu-button:top-1.5',
          'peer-data-[size=lg]/menu-button:top-2.5',
          'group-data-[collapsible=icon]:hidden',
        ].join(' '),
        className
      )}
      {...props}
    />
  )
)

export const SidebarMenuSkeleton = createForwardedComponent<
  'div',
  { showIcon?: boolean }
>('SidebarMenuSkeleton', ({ className, showIcon = false, ...props }, ref) => {
  const width = React.useMemo(
    () => `${Math.floor(Math.random() * 40) + 50}%`,
    []
  )

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn('rounded-md h-8 flex gap-2 px-2 items-center', className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 flex-1 max-w-[--skeleton-width]"
        data-sidebar="menu-skeleton-text"
        style={{ '--skeleton-width': width } as React.CSSProperties}
      />
    </div>
  )
})

// Sub-menu components
export const SidebarMenuSub = createForwardedComponent<'ul'>(
  'SidebarMenuSub',
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cn(
        [
          'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1',
          'border-l border-sidebar-border px-2.5 py-0.5',
          'group-data-[collapsible=icon]:hidden',
        ].join(' '),
        className
      )}
      {...props}
    />
  )
)

export const SidebarMenuSubItem = createForwardedComponent<'li'>(
  'SidebarMenuSubItem',
  (props, ref) => <li ref={ref} {...props} />
)

export const SidebarMenuSubButton = createForwardedComponent<
  'a',
  {
    asChild?: boolean
    size?: 'sm' | 'md'
    isActive?: boolean
  }
>(
  'SidebarMenuSubButton',
  ({ asChild = false, size = 'md', isActive, className, ...props }, ref) => {
    const Comp = asChild ? Slot : 'a'

    return (
      <Comp
        ref={ref}
        data-sidebar="menu-sub-button"
        data-size={size}
        data-active={isActive}
        className={cn(
          [
            'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2',
            'text-sidebar-foreground outline-none ring-sidebar-ring',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2',
            'active:bg-sidebar-accent active:text-sidebar-accent-foreground',
            'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
            '[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
            'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            'group-data-[collapsible=icon]:hidden',
          ].join(' '),
          className
        )}
        {...props}
      />
    )
  }
)
