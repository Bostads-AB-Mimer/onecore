import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Newspaper,
} from 'lucide-react'

import { RELEASE_NOTES, sortReleaseNotesByPinned } from '@/entities/release-note'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

import { ReleaseNoteItem } from './ReleaseNoteItem'
import { ReleaseNotesModal } from './ReleaseNotesModal'
import { SupportMessage } from './SupportMessage'

const ITEMS_PER_PAGE = 3

export function ReleaseNotesCard() {
  const [page, setPage] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [scrollToNoteId, setScrollToNoteId] = useState<string | undefined>()

  const openModal = (noteId?: string) => {
    setScrollToNoteId(noteId)
    setIsModalOpen(true)
  }

  const sortedNotes = useMemo(() => sortReleaseNotesByPinned(RELEASE_NOTES), [])

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
        <CardTitle
          className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
          onClick={() => openModal()}
        >
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
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ReleaseNoteItem
                        note={note}
                        onClick={() => openModal(note.id)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
              <div className="mt-6 pt-4 border-t text-center">
                <SupportMessage />
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
              {/* View all link */}
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => openModal()}
                  className="text-sm text-primary hover:underline"
                >
                  Visa alla nyheter →
                </button>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
      <ReleaseNotesModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        scrollToNoteId={scrollToNoteId}
      />
    </Card>
  )
}
