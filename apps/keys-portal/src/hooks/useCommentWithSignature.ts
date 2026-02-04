import { format } from 'date-fns'

import { useUser } from '@/auth/useUser'

/**
 * Hook that provides a function to append a signature to a comment.
 * Signature format: "Comment text\n\n2024-01-15 14:30 Username"
 */
/**
 * Abbreviates a name to first 3 chars of first name + first 3 chars of last name.
 * Example: "Sebastian Salas" -> "SEBSAL"
 */
function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) {
    // Single name - just take first 6 chars
    return fullName.slice(0, 6).toUpperCase()
  }
  const firstName = parts[0].slice(0, 3)
  const lastName = parts[parts.length - 1].slice(0, 3)
  return `${firstName}${lastName}`.toUpperCase()
}

export function useCommentWithSignature() {
  const userState = useUser()

  const addSignature = (comment: string): string | undefined => {
    if (!comment?.trim()) return undefined

    const fullName = userState.tag === 'success' ? userState.user.name : 'Okänd'
    const abbreviation = abbreviateName(fullName)
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm')
    const signature = `${timestamp} ${abbreviation}`

    return `${comment.trim()}\n\n${signature}`
  }

  return { addSignature }
}
