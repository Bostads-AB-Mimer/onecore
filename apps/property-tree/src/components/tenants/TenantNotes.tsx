import { useTenantComments } from '@/hooks/useTenantComments'
import { Card, CardContent } from '@/components/ui/v2/Card'

interface TenantNotesProps {
  contactCode: string | undefined
}

export function TenantNotes({ contactCode }: TenantNotesProps) {
  const { data: comments, isLoading, error } = useTenantComments(contactCode)

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

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Inga noteringar har lagts till för denna kontakt ännu.
      </div>
    )
  }

  return (
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
  )
}
