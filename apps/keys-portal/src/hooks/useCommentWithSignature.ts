import { format } from 'date-fns'
import { useUser } from '@/auth/useUser'

/**
 * Hook that provides a function to append a signature to a comment.
 * Signature format: "Comment text\n\n2024-01-15 14:30 Username"
 */
export function useCommentWithSignature() {
  const userState = useUser()

  const addSignature = (comment: string): string | undefined => {
    if (!comment?.trim()) return undefined

    const userName = userState.tag === 'success' ? userState.user.name : 'Okänd'
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm')
    const signature = `${timestamp} ${userName}`

    return `${comment.trim()}\n\n${signature}`
  }

  return { addSignature }
}
