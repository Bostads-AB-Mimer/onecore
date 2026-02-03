import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { fetchContactByContactCode } from '@/services/api/contactService'
import type { Contact } from '@/services/types'

interface ContactSearchProps {
  onResultFound: (contact: Contact | null, searchValue: string) => void
}

/**
 * Hook for contact search logic.
 * Handles fetching contact details after user selects from autocomplete.
 */
export function useContactCodeSearch({ onResultFound }: ContactSearchProps) {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Trigger search when URL parameters are present
  useEffect(() => {
    const contactParam = searchParams.get('contact')

    if (contactParam) {
      handleSearchByContactCode(contactParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSearchByContactCode = async (contactCode: string) => {
    setLoading(true)
    try {
      const contact = await fetchContactByContactCode(contactCode)
      if (!contact) {
        toast({
          title: 'Ingen träff',
          description: 'Hittade ingen kontakt för angivet kontaktnummer.',
        })
        return
      }
      onResultFound(contact, contactCode)
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : 'Okänt fel'
      toast({
        title: 'Kunde inte söka',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return {
    handleContactSelect: handleSearchByContactCode,
    loading,
  }
}
