import { Tag } from '@/shared/ui/Tag'

import { getBuildingTypeStyle } from '../utils/buildingTypeHelpers'

interface BuildingTypeBadgeProps {
  type: { code: string | null; name: string | null } | null | undefined
  className?: string
}

export function BuildingTypeBadge({ type, className }: BuildingTypeBadgeProps) {
  if (!type?.code) return null

  const style = getBuildingTypeStyle(type.code)
  if (!style) return null

  return (
    <Tag bg={style.bg} color={style.text} className={className}>
      {type.name ?? style.label}
    </Tag>
  )
}
