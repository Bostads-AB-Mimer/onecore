import { Badge } from '@/shared/ui/Badge'

interface GuideStatusBadgeProps {
  status: 'draft' | 'published'
}

export function GuideStatusBadge({ status }: GuideStatusBadgeProps) {
  if (status === 'published') {
    return <Badge variant="success">Publicerad</Badge>
  }
  return <Badge variant="secondary">Utkast</Badge>
}
