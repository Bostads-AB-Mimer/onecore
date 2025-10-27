import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { fetchContactByContactCode } from '@/services/api/contactService'
import type { Contact } from '@/services/types'

interface ContactCodeSearchProps {
  onResultFound: (contact: Contact | null, searchValue: string) => void
}

const isContactCode = (value: string) => {
  const trimmed = value.trim().toUpperCase()
  // Contact codes start with P or F and contain only letters/numbers (no dashes or spaces)
  return /^[PF][A-Z0-9]+$/.test(trimmed) && trimmed.length >= 4
}

/**
 * Hook for contact code search logic (PXXXXXX/FXXXXXX).
 * Returns search state and handlers to be used with SearchInput component.
 */
export function useContactCodeSearch({
  onResultFound,
}: ContactCodeSearchProps) {
  const [searchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    const value = searchValue.trim()
    if (!value) {
      toast({
        title: 'Saknar värde',
        description: 'Ange ett kundnummer.',
        variant: 'destructive',
      })
      return
    }

    if (!isContactCode(value)) {
      toast({
        title: 'Ogiltigt format',
        description:
          'Ange ett giltigt kundnummer (PXXXXXX eller FXXXXXX, t.ex. P053602 eller F123456).',
        variant: 'destructive',
      })
      return
    }

    await handleSearchByContactCode(value)
  }

  // Trigger search when URL parameters are present
  useEffect(() => {
    const contactParam = searchParams.get('contact')

    if (contactParam && isContactCode(contactParam)) {
      setSearchValue(contactParam)
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
          description: 'Hittade ingen kontakt för angivet kundnummer.',
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
    searchValue,
    setSearchValue,
    handleSearch,
    loading,
  }
}
