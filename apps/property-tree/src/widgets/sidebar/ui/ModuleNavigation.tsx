import { type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ModuleNavItem, OnecoreModule } from '@onecore/ui'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@radix-ui/react-collapsible'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/Sidebar'

const joinPath = (base: string, to: string) => (to ? `${base}/${to}` : base)

const matches = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

const hasActiveDescendant = (
  item: ModuleNavItem,
  base: string,
  pathname: string
): boolean =>
  (item.children ?? []).some(
    (child) =>
      (child.to !== undefined && matches(pathname, joinPath(base, child.to))) ||
      hasActiveDescendant(child, base, pathname)
  )

/** Same markup as the Fastighetsdata tree: menu buttons, children indented with pl-4. */
function NavItem({ item, base }: { item: ModuleNavItem; base: string }) {
  const { pathname } = useLocation()
  const href = item.to === undefined ? undefined : joinPath(base, item.to)
  const inside =
    (href !== undefined && matches(pathname, href)) ||
    hasActiveDescendant(item, base, pathname)
  // Deepest matching item wins, so a parent is not highlighted with its child.
  const isActive =
    href !== undefined &&
    matches(pathname, href) &&
    !hasActiveDescendant(item, base, pathname)

  // Controlled so the group opens when navigation lands inside it, not only on mount.
  const [open, setOpen] = useState(href === undefined || inside)
  useEffect(() => {
    if (inside) setOpen(true)
  }, [inside])

  const label = (
    <>
      {item.icon && <item.icon />}
      <span>{item.label}</span>
      {item.children && (
        <ChevronRight
          className={cn('ml-auto transition-transform', open && 'rotate-90')}
        />
      )}
    </>
  )

  // A group header (no `to`) and a disabled item render as buttons, not links.
  const button: ReactNode =
    item.disabled || href === undefined ? (
      <SidebarMenuButton
        tooltip={item.label}
        aria-disabled={item.disabled ? 'true' : undefined}
        className={item.disabled ? 'pointer-events-none opacity-50' : undefined}
      >
        {label}
      </SidebarMenuButton>
    ) : (
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link to={href} onClick={() => setOpen(true)}>
          {label}
        </Link>
      </SidebarMenuButton>
    )

  if (!item.children) {
    return <SidebarMenuItem>{button}</SidebarMenuItem>
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        {/* A linked parent navigates and opens; only a plain header toggles. */}
        {href === undefined ? (
          <CollapsibleTrigger asChild>{button}</CollapsibleTrigger>
        ) : (
          button
        )}
        <CollapsibleContent>
          <div className="pl-4 mt-1">
            <SidebarMenu>
              {item.children.map((child) => (
                <NavItem key={child.label} item={child} base={base} />
              ))}
            </SidebarMenu>
          </div>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

/** Renders a module's navigation tree under its basePath. */
export function ModuleNavigation({ module }: { module: OnecoreModule }) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {module.navigation.map((item) => (
          <NavItem key={item.label} item={item} base={module.basePath} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
