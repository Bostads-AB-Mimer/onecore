import { Link } from 'react-router-dom'
import { EyeOff } from 'lucide-react'

import { routes } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

interface UnpublishedGuideNoticeProps {
  title: string
  /** Run when the reader follows the link out, e.g. to close a sheet. */
  onNavigate?: () => void
}

/** Shown to readers who follow a link to a guide that is still a draft. */
export function UnpublishedGuideNotice({
  title,
  onNavigate,
}: UnpublishedGuideNoticeProps) {
  return (
    <EmptyState
      icon={EyeOff}
      title="Guiden är inte publicerad än"
      description={`"${title}" är fortfarande ett utkast. Be den som skickade länken att publicera guiden.`}
      action={
        <Button asChild variant="outline">
          <Link to={routes.guides} onClick={onNavigate}>
            Till alla guider
          </Link>
        </Button>
      }
    />
  )
}
