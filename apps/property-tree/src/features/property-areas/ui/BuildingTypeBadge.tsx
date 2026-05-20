import React from 'react'

import { Tag } from '@/shared/ui/Tag'

import { getBuildingTypeName } from '../data'
import { getBuildingTypeStyle } from '../utils/buildingTypeColors'

interface BuildingTypeBadgeProps {
  type: string | undefined
  className?: string
}

export function BuildingTypeBadge({ type, className }: BuildingTypeBadgeProps) {
  if (!type) return null

  const style = getBuildingTypeStyle(type)
  if (!style) return null

  return (
    <Tag bg={style.bg} color={style.text} className={className}>
      {getBuildingTypeName(type)}
    </Tag>
  )
}
