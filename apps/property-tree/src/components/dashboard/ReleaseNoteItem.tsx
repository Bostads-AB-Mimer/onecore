import { Pin } from 'lucide-react'
import { Badge } from '@/components/ui/v2/Badge'
import {
  RELEASE_NOTE_CATEGORY_LABELS,
  RELEASE_NOTE_CATEGORY_ICONS,
  RELEASE_NOTE_BADGE_STYLES,
  RELEASE_NOTE_ICON_STYLES,
  formatReleaseNoteDate,
} from '@/data/release-notes'
import type { ReleaseNote } from '@/services/types'

interface ReleaseNoteItemProps {
  note: ReleaseNote
  /** Optional id attribute for scroll targeting */
  id?: string
  /** Optional click handler to make the item interactive */
  onClick?: () => void
  /** Additional className for the container */
  className?: string
}

/**
 * Shared component for displaying a single release note item.
 * Used in both ReleaseNotesCard and ReleaseNotesModal.
 */
export function ReleaseNoteItem({
  note,
  id,
  onClick,
  className = '',
}: ReleaseNoteItemProps) {
  const Icon = RELEASE_NOTE_CATEGORY_ICONS[note.category]

  const content = (
    <>
      <div
        className={`p-2 rounded-full flex-shrink-0 ${RELEASE_NOTE_ICON_STYLES[note.category]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={RELEASE_NOTE_BADGE_STYLES[note.category]}>
            {RELEASE_NOTE_CATEGORY_LABELS[note.category]}
          </Badge>
          {note.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">
            {formatReleaseNoteDate(note.date)}
          </span>
        </div>
        <p className="font-semibold">{note.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {note.description}
        </p>
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        id={id}
        onClick={onClick}
        className={`flex items-start gap-4 w-full text-left cursor-pointer rounded-lg p-2 -m-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${className}`}
      >
        {content}
      </button>
    )
  }

  return (
    <div id={id} className={`flex items-start gap-4 ${className}`}>
      {content}
    </div>
  )
}
