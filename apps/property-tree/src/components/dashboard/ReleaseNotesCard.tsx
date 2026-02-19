import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Newspaper,
  Sparkles,
  Bug,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  Pin,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v2/Badge'
import {
  RELEASE_NOTES,
  RELEASE_NOTE_CATEGORY_LABELS,
} from '@/data/release-notes'
import type { ReleaseNote, ReleaseNoteCategory } from '@/services/types'

const ITEMS_PER_PAGE = 3

const categoryIcons: Record<ReleaseNoteCategory, React.ElementType> = {
  feature: Sparkles,
  fix: Bug,
  improvement: Zap,
  info: Info,
  warning: AlertTriangle,
}

const categoryBadgeStyles: Record<ReleaseNoteCategory, string> = {
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  fix: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  improvement:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  warning:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

const categoryIconStyles: Record<ReleaseNoteCategory, string> = {
  feature: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  fix: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  improvement:
    'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  info: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  warning:
    'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface ReleaseNoteItemProps {
  note: ReleaseNote
  index: number
}

function ReleaseNoteItem({ note, index }: ReleaseNoteItemProps) {
  const Icon = categoryIcons[note.category]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-2 rounded-full flex-shrink-0 ${categoryIconStyles[note.category]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={categoryBadgeStyles[note.category]}>
              {RELEASE_NOTE_CATEGORY_LABELS[note.category]}
            </Badge>
            {note.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">
              {formatDate(note.date)}
            </span>
          </div>
          <p className="font-semibold">{note.title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {note.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export function ReleaseNotesCard() {
  const [page, setPage] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Sort notes: pinned first, then by date
  const sortedNotes = useMemo(() => {
    return [...RELEASE_NOTES].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return 0 // Keep original order (already sorted by date)
    })
  }, [])

  const totalPages = Math.ceil(sortedNotes.length / ITEMS_PER_PAGE)
  const startIndex = page * ITEMS_PER_PAGE
  const visibleNotes = sortedNotes.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )

  const canGoPrev = page > 0
  const canGoNext = page < totalPages - 1

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          Nyheter och uppdateringar
        </CardTitle>
        <button
          onClick={() => setIsCollapsed((c) => !c)}
          className="lg:hidden p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={isCollapsed ? 'Visa' : 'Dölj'}
        >
          {isCollapsed ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </button>
      </CardHeader>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {visibleNotes.map((note, index) => (
              <ReleaseNoteItem key={note.id} note={note} index={index} />
            ))}
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Har du frågor eller behöver hjälp? Tveka inte att höra av dig till{' '}
            <span className="font-semibold text-primary">David</span> eller{' '}
            <span className="font-semibold text-primary">Lina</span> - vi finns
            här för att stötta dig!
          </p>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-4 pt-4 border-t">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!canGoPrev}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Föregående"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground px-1">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!canGoNext}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Nästa"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
