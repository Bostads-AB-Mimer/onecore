import { useState, useMemo } from 'react'
import { useTenantComments } from '@/hooks/useTenantComments'
import { useCreateTenantComment } from '@/hooks/useCreateTenantComment'
import { useUser } from '@/auth/useUser'
import { Card, CardContent } from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/v2/Button'
import { Badge } from '@/components/ui/v2/Badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v2/Tabs'
import { Textarea } from '@/components/ui/Textarea'
import { Plus, Save } from 'lucide-react'
import { generateAuthorAbbreviation } from '@/utils/formatters'

interface TenantNotesProps {
  contactCode: string | undefined
}

type CommentType = 'Standard' | 'Sökande'
type CommentTypeFilter = CommentType | 'all'

export function TenantNotes({ contactCode }: TenantNotesProps) {
  // Filter state
  const [commentTypeFilter, setCommentTypeFilter] =
    useState<CommentTypeFilter>('all')

  // Form state
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [newNoteType, setNewNoteType] = useState<CommentType>('Standard')

  // Hooks
  const { data: allComments, isLoading, error } = useTenantComments(contactCode)
  const createComment = useCreateTenantComment()
  const userState = useUser()

  // Frontend filtering: We fetch all comments and filter in the browser
  // since the number of comments per contact is typically small.
  const filteredComments = useMemo(() => {
    if (commentTypeFilter === 'all') {
      return allComments
    }
    return allComments.filter(
      (comment) => comment.commentType === commentTypeFilter
    )
  }, [allComments, commentTypeFilter])

  const formatDate = (dateString: string | null, hasTime: boolean): string => {
    if (!dateString) {
      return 'Datum saknas'
    }
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      ...(hasTime && { hour: '2-digit', minute: '2-digit' }),
    }
    return new Date(dateString).toLocaleDateString('sv-SE', options)
  }

  const handleAddNote = async () => {
    if (!contactCode || !newNoteContent.trim()) {
      return
    }

    // Get user name and generate abbreviation
    const userName =
      userState.tag === 'success' ? userState.user.name : 'Unknown User'
    const author = generateAuthorAbbreviation(userName)

    try {
      await createComment.mutateAsync({
        contactCode,
        content: newNoteContent.trim(),
        author,
        commentType: newNoteType,
      })

      // Reset form on success
      setNewNoteContent('')
      setNewNoteType('Standard')
      setIsAddingNote(false)
    } catch (err) {
      // Error is handled by the mutation hook
      console.error('Failed to create comment:', err)
    }
  }

  const startAddingNote = () => {
    setIsAddingNote(true)
  }

  const cancelAddingNote = () => {
    setIsAddingNote(false)
    setNewNoteContent('')
    setNewNoteType('Standard')
  }

  if (error) {
    return (
      <div className="text-center py-4 text-destructive text-sm">
        Kunde inte ladda noteringar
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Laddar noteringar...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with filter and add button */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Filter tabs (smaller variant) */}
        <Tabs
          value={commentTypeFilter}
          onValueChange={(value) =>
            setCommentTypeFilter(value as CommentTypeFilter)
          }
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="px-2 py-1 text-xs">
              Alla
            </TabsTrigger>
            <TabsTrigger value="Standard" className="px-2 py-1 text-xs">
              Standard
            </TabsTrigger>
            <TabsTrigger value="Sökande" className="px-2 py-1 text-xs">
              Sökande
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Add note button */}
        {!isAddingNote && (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={startAddingNote}
          >
            <Plus className="h-4 w-4" />
            Ny notering
          </Button>
        )}
      </div>

      {/* Add note form */}
      {isAddingNote && (
        <div className="border p-3 rounded-md bg-muted/20 space-y-3">
          {/* Comment type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Typ av notering</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="noteType"
                  value="Standard"
                  checked={newNoteType === 'Standard'}
                  onChange={() => setNewNoteType('Standard')}
                  className="w-4 h-4"
                  disabled={createComment.isPending}
                />
                <span className="text-sm">Standard</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="noteType"
                  value="Sökande"
                  checked={newNoteType === 'Sökande'}
                  onChange={() => setNewNoteType('Sökande')}
                  className="w-4 h-4"
                  disabled={createComment.isPending}
                />
                <span className="text-sm">Sökande</span>
              </label>
            </div>
          </div>

          <Textarea
            placeholder="Skriv din notering här..."
            className="min-h-[80px] text-sm"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            disabled={createComment.isPending}
          />
          {createComment.isError && (
            <p className="text-sm text-destructive">
              Kunde inte spara notering. Försök igen.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelAddingNote}
              disabled={createComment.isPending}
            >
              Avbryt
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              className="flex items-center gap-1"
              disabled={createComment.isPending || !newNoteContent.trim()}
            >
              {createComment.isPending ? (
                'Sparar...'
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Spara
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {filteredComments.length === 0 ? (
        <p className="text-muted-foreground text-center py-4 text-sm">
          {commentTypeFilter === 'all'
            ? 'Inga noteringar har lagts till för denna kontakt ännu.'
            : `Inga ${commentTypeFilter}-noteringar hittades.`}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredComments.map((comment) => (
            <Card
              key={comment.id}
              className={
                comment.commentType === 'Sökande'
                  ? 'border-l-4 border-l-blue-400'
                  : comment.commentType === 'Standard'
                    ? 'border-l-4 border-l-emerald-400'
                    : ''
              }
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs text-muted-foreground">
                    {!comment.createdAt &&
                    comment.author === 'Notering utan signatur'
                      ? 'Osignerad notering'
                      : `${formatDate(comment.createdAt, comment.hasTime)} av ${comment.author}`}
                  </p>
                  {/* Show badge for comment type when viewing all */}
                  {commentTypeFilter === 'all' && comment.commentType && (
                    <Badge
                      variant={
                        comment.commentType === 'Sökande'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {comment.commentType}
                    </Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {comment.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
