import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { getKeyBundleById } from '@/services/api/keyBundleService'
import type { Contact } from '@/services/types'

export type SearchType = 'contact' | 'bundle'

export interface SearchResult {
  type: SearchType
  contact?: Contact
  bundleId?: string
  bundleName?: string
}

interface UnifiedMaintenanceSearchHookProps {
  onResultFound: (result: SearchResult, searchValue: string) => void
}

/**
 * Hook for unified maintenance search logic.
 * Handles both contact and key bundle searches.
 */
export function useUnifiedMaintenanceSearch({
  onResultFound,
}: UnifiedMaintenanceSearchHookProps) {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Trigger search when URL parameters are present
  useEffect(() => {
    const contactParam = searchParams.get('contact')
    const bundleParam = searchParams.get('bundle')

    if (contactParam) {
      handleSearchByContactCode(contactParam)
    } else if (bundleParam) {
      handleSearchByBundleId(bundleParam)
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
      onResultFound({ type: 'contact', contact }, contactCode)
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

  const handleSearchByBundleId = async (bundleId: string) => {
    setLoading(true)
    try {
      const bundle = await getKeyBundleById(bundleId)
      if (!bundle) {
        toast({
          title: 'Ingen träff',
          description: 'Hittade ingen nyckelsamling för angivet ID.',
        })
        return
      }
      onResultFound(
        { type: 'bundle', bundleId: bundle.id, bundleName: bundle.name },
        bundleId
      )
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
    handleSelectContact: handleSearchByContactCode,
    handleSelectBundle: handleSearchByBundleId,
    loading,
  }
}
