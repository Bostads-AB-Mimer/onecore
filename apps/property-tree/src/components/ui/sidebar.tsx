"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, children, ...props }: SidebarProps) {
  return (
    <div className={cn("pb-12", className)} {...props}>
      {children}
    </div>
  )
}

interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
}

export function SidebarSection({
  className,
  children,
  title,
  ...props
}: SidebarSectionProps) {
  return (
    <div className={cn("pb-8", className)} {...props}>
      {title && (
        <h2 className="mb-4 px-2 text-lg font-semibold tracking-tight">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}

interface SidebarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  isActive?: boolean
}

export function SidebarItem({
  className,
  children,
  icon,
  title,
  isActive,
  ...props
}: SidebarItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent",
        className
      )}
      {...props}
    >
      {icon && <span className="mr-2 h-4 w-4">{icon}</span>}
      <span>{title}</span>
      {children}
    </div>
  )
}

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SidebarNav({ className, children, ...props }: SidebarNavProps) {
  return (
    <nav className={cn("grid items-start gap-2", className)} {...props}>
      {children}
    </nav>
  )
}
