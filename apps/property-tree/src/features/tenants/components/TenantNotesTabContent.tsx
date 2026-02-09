import { useState } from 'react'
import { useTenantComments } from '../hooks/useTenantComments'
import { useCreateTenantComment } from '../hooks/useCreateTenantComment'
import { useUser } from '@/auth/useUser'
import { Card, CardContent } from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/v2/Button'
import { Textarea } from '@/components/ui/Textarea'
import { TabLayout } from '@/components/ui/TabLayout'
import { Plus, Save } from 'lucide-react'
import { generateAuthorAbbreviation } from '@/utils/formatters'

interface TenantNotesTabContentProps {
  contactCode: string | undefined
}

export function TenantNotesTabContent({
  contactCode,
}: TenantNotesTabContentProps) {
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')

  const { data: comments, isLoading, error } = useTenantComments(contactCode)
  const createComment = useCreateTenantComment()
  const userState = useUser()

  const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      })

      // Reset form on success
      setNewNoteContent('')
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
  }

  return (
    <TabLayout
      title="Noteringar"
      showCard={true}
      isLoading={isLoading}
      error={error as Error | null}
      errorMessage="Kunde inte ladda noteringar"
    >
      {/* Add note button */}
      {!isAddingNote && (
        <div className="flex justify-start">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={startAddingNote}
          >
            <Plus className="h-4 w-4" />
            Ny notering
          </Button>
        </div>
      )}

      {/* Add note form */}
      {isAddingNote && (
        <div className="border p-3 rounded-md bg-muted/20 space-y-3">
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
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-center py-4 text-sm">
          Inga noteringar har lagts till för denna kontakt ännu.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  {formatDate(comment.createdAt)} av {comment.author}
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {comment.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabLayout>
  )
}
