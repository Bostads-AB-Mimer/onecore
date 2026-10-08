import type { ComponentType, ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

/** The logged-in user as a host knows it. Hosts map their own user shape to this. */
export interface ModuleUser {
  id: string
  name?: string
  email?: string
  roles: string[]
}

export interface ModuleNavItem {
  label: string
  /** Relative to the module's basePath; '' is the module root. Omit for a plain group header. */
  to?: string
  icon?: ComponentType<{ className?: string }>
  /** Shown greyed out and not linked. */
  disabled?: boolean
  children?: ModuleNavItem[]
}

export interface ModuleHostProps {
  user: ModuleUser
  /** Base URL of core, e.g. https://api.mimer.nu. */
  coreUrl: string
  /** Resolves a config value the way the host does (injected config, env, default). */
  env: (name: string, defaultValue: string) => string
  children: ReactNode
}

/**
 * An optional frontend package a host app mounts under `basePath`.
 * The host renders `navigation` in its menu and `routes` under `Host`,
 * and knows nothing else about the module.
 */
export interface OnecoreModule {
  id: string
  /** Absolute mount path in the host, e.g. '/uthyrning'. */
  basePath: string
  /** Document title for the module root. */
  title: string
  routes: RouteObject[]
  navigation: ModuleNavItem[]
  /** Wraps the module's routes with whatever its pages need from the host. */
  Host: ComponentType<ModuleHostProps>
}
