import { useState, useEffect, useCallback } from 'react'
import { KeyBundlesHeader } from '@/components/key-bundles/KeyBundlesHeader'
import { KeyBundlesToolbar } from '@/components/key-bundles/KeyBundlesToolbar'
import { KeyBundlesTable } from '@/components/key-bundles/KeyBundlesTable'
import { AddKeyBundleForm } from '@/components/key-bundles/AddKeyBundleForm'

import { KeyBundle, KeyDetails } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import * as keyBundleService from '@/services/api/keyBundleService'
import { useUrlPagination } from '@/hooks/useUrlPagination'

export default function KeyBundles() {
  const pagination = useUrlPagination()
  const [keyBundles, setKeyBundles] = useState<KeyBundle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKeyBundle, setEditingKeyBundle] = useState<KeyBundle | null>(
    null
  )
  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null)
  const [keysForExpandedBundle, setKeysForExpandedBundle] = useState<
    KeyDetails[]
  >([])
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const { toast } = useToast()

  // Read search query from URL
  const searchQuery = pagination.searchParams.get('q') || ''

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)

  // Load key bundles from API
  const loadKeyBundles = useCallback(async () => {
    try {
      setIsLoading(true)

      // Use search if there's a query, otherwise get all bundles
      const bundles =
        searchQuery.trim().length >= 3
          ? await keyBundleService.searchKeyBundles(searchQuery.trim())
          : await keyBundleService.getAllKeyBundles()

      setKeyBundles(bundles)
    } catch (error) {
      console.error('Failed to load key bundles:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte ladda nyckelsamlingar.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, toast])

  // Sync local search input with URL query
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Fetch data whenever search query changes
  useEffect(() => {
    loadKeyBundles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchInput(query)
      // Update URL with search query
      if (query.trim().length >= 3 || query.trim().length === 0) {
        pagination.updateUrlParams({
          q: query.trim().length > 0 ? query.trim() : null,
        })
      }
    },
    [pagination]
  )

  const handleAddNew = () => {
    if (showAddForm && !editingKeyBundle) {
      // If form is already open for adding new (not editing), close it
      setShowAddForm(false)
    } else {
      // Otherwise open form for adding new
      setEditingKeyBundle(null)
      setShowAddForm(true)
    }
  }

  const handleEdit = (keyBundle: KeyBundle) => {
    setEditingKeyBundle(keyBundle)
    setShowAddForm(true)
  }

  const handleSave = async (keyBundleData: {
    name: string
    description: string | null
    keys: string[]
  }) => {
    try {
      // Convert keys array to JSON string
      const bundleWithStringKeys = {
        name: keyBundleData.name,
        keys: JSON.stringify(keyBundleData.keys),
        description: keyBundleData.description,
      }

      if (editingKeyBundle) {
        // Update existing key bundle
        const updated = await keyBundleService.updateKeyBundle(
          editingKeyBundle.id,
          bundleWithStringKeys
        )
        setKeyBundles((prev) =>
          prev.map((kb) => (kb.id === editingKeyBundle.id ? updated : kb))
        )
        toast({
          title: 'Nyckelsamling uppdaterad',
          description: `${keyBundleData.name} har uppdaterats framgångsrikt.`,
        })
      } else {
        // Create new key bundle
        const newKeyBundle =
          await keyBundleService.createKeyBundle(bundleWithStringKeys)
        setKeyBundles((prev) => [...prev, newKeyBundle])
        toast({
          title: 'Nyckelsamling skapad',
          description: `${keyBundleData.name} har skapats framgångsrikt.`,
        })
      }
      setShowAddForm(false)
    } catch (error: any) {
      console.error('Failed to save key bundle:', error)

      toast({
        title: 'Fel',
        description: error?.message || 'Kunde inte spara nyckelsamlingen.',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingKeyBundle(null)
  }

  const handleDelete = async (id: string) => {
    const keyBundle = keyBundles.find((kb) => kb.id === id)
    if (!keyBundle) return

    try {
      await keyBundleService.deleteKeyBundle(id)
      setKeyBundles((prev) => prev.filter((kb) => kb.id !== id))
      toast({
        title: 'Nyckelsamling borttagen',
        description: `${keyBundle.name} har tagits bort.`,
        variant: 'destructive',
      })
    } catch (error) {
      console.error('Failed to delete key bundle:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort nyckelsamlingen.',
        variant: 'destructive',
      })
    }
  }

  const handleToggleExpand = async (bundleId: string) => {
    if (expandedBundleId === bundleId) {
      // Collapse if already expanded
      setExpandedBundleId(null)
      setKeysForExpandedBundle([])
    } else {
      // Expand and load keys with loan status
      setExpandedBundleId(bundleId)
      setIsLoadingKeys(true)
      try {
        const response = await keyBundleService.getKeyBundleDetails(bundleId, {
          includeLoans: true,
          includeEvents: true,
          includeKeySystem: true,
        })
        if (response) {
          setKeysForExpandedBundle(response.keys)
        } else {
          setKeysForExpandedBundle([])
        }
      } catch (error) {
        console.error('Failed to load keys with loan status:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda nycklar för denna samling.',
          variant: 'destructive',
        })
        setKeysForExpandedBundle([])
      } finally {
        setIsLoadingKeys(false)
      }
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <KeyBundlesHeader
        totalKeyBundles={keyBundles.length}
        displayedKeyBundles={keyBundles.length}
      />

      <KeyBundlesToolbar
        searchQuery={searchInput}
        onSearchChange={handleSearchChange}
        onAddNew={handleAddNew}
      />

      {showAddForm && (
        <AddKeyBundleForm
          onSave={handleSave}
          onCancel={handleCancel}
          editingKeyBundle={editingKeyBundle}
        />
      )}

      <KeyBundlesTable
        keyBundles={keyBundles}
        onEdit={handleEdit}
        onDelete={handleDelete}
        expandedBundleId={expandedBundleId}
        onToggleExpand={handleToggleExpand}
        keysForExpandedBundle={keysForExpandedBundle}
        isLoadingKeys={isLoadingKeys}
        isLoading={isLoading}
        onRefresh={loadKeyBundles}
      />
    </div>
  )
}
