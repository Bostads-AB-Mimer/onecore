import { useState } from 'react'

interface UseClipboardCopyOptions {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useClipboardCopy(options?: UseClipboardCopyOptions) {
  const [isCopied, setIsCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      options?.onSuccess?.()

      // Reset icon after 2 seconds
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      options?.onError?.(error as Error)
    }
  }

  return { copyToClipboard, isCopied }
}
