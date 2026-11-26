import type { Component } from '@/services/types'

export function isSurfaceComponent(component: Component): boolean {
  return component.subtype?.componentType?.category?.type === 'SURFACE'
}
