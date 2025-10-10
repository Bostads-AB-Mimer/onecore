import { useState, useMemo, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { Key, KeyType, KeySystem } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { useToast } from '@/hooks/use-toast'

const DEFAULT_KEY_TYPE: KeyType = 'LGH'

type AddKeyButtonProps = {
  onClick: () => void
  disabled?: boolean
}

export function AddKeyButton({ onClick, disabled = false }: AddKeyButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1"
    >
      <Plus className="h-3 w-3" />
      Lägg till nyckel
    </Button>
  )
}

type Props = {
  keys: Key[]
  rentalObjectCode: string
  onKeyCreated: (key: Key) => void
  onCancel: () => void
}

export function AddKeyForm({
  keys,
  rentalObjectCode,
  onKeyCreated,
  onCancel,
}: Props) {
  const { toast } = useToast()
  const [draftName, setDraftName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [defaultKeySystem, setDefaultKeySystem] = useState<KeySystem | null>(
    null
  )

  // Calculate next sequence number
  const nextSequenceNumber = useMemo(() => {
    const seqs = keys
      .filter(
        (k) =>
          k.rentalObjectCode === rentalObjectCode &&
          k.keyType === DEFAULT_KEY_TYPE
      )
      .map((k) => Number(k.keySequenceNumber || 0))
    const max = seqs.length ? Math.max(...seqs) : 0
    return max + 1
  }, [keys, rentalObjectCode])

  // Determine default key system ID
  const defaultKeySystemId = useCallback(() => {
    const sameType = keys.find(
      (k) =>
        k.rentalObjectCode === rentalObjectCode &&
        k.keyType === DEFAULT_KEY_TYPE &&
        k.keySystemId
    )
    if (sameType?.keySystemId) return sameType.keySystemId
    const anyOnObject = keys.find(
      (k) => k.rentalObjectCode === rentalObjectCode && k.keySystemId
    )
    return anyOnObject?.keySystemId ?? ''
  }, [keys, rentalObjectCode])

  const effectiveDefaultKeySystemId = useMemo(
    () => defaultKeySystemId(),
    [defaultKeySystemId]
  )

  // Fetch key system details
  useEffect(() => {
    let cancelled = false
    const id = effectiveDefaultKeySystemId
    if (!id) {
      setDefaultKeySystem(null)
      return
    }
    ;(async () => {
      try {
        const ks = await (keyService as any).getKeySystem?.(id)
        if (!cancelled) setDefaultKeySystem(ks ?? null)
      } catch {
        if (!cancelled) setDefaultKeySystem(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [effectiveDefaultKeySystemId])

  const keySystemDisplayCode = useMemo(() => {
    const ks = defaultKeySystem as any
    return (
      ks?.systemCode ??
      ks?.system_code ??
      ks?.systemcode ??
      ks?.name ??
      effectiveDefaultKeySystemId ??
      '—'
    )
  }, [defaultKeySystem, effectiveDefaultKeySystemId])

  const handleSubmit = async () => {
    if (!draftName.trim()) return

    setIsSubmitting(true)
    try {
      const payload = {
        keyName: draftName.trim(),
        keyType: DEFAULT_KEY_TYPE,
        keySequenceNumber: nextSequenceNumber,
        rentalObjectCode,
        keySystemId: effectiveDefaultKeySystemId || undefined,
      }
      const created = await keyService.createKey(payload)

      toast({
        title: 'Nyckel skapad',
        description: `${created.keyName} (${KeyTypeLabels[DEFAULT_KEY_TYPE]}) – Löp ${created.keySequenceNumber}`,
      })

      setDraftName('')
      onKeyCreated(created)
    } catch (e: any) {
      toast({
        title: 'Kunde inte skapa nyckel',
        description: e?.message ?? 'Okänt fel',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="col-span-1 md:col-span-2">
          <label className="text-xs block mb-1">Nyckelnamn *</label>
          <input
            className="h-8 w-full border rounded px-2 bg-background"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={`t.ex. LGH-${nextSequenceNumber}`}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="text-xs block mb-1">Typ</label>
          <input
            className="h-8 w-full border rounded px-2 bg-muted text-muted-foreground"
            value={KeyTypeLabels[DEFAULT_KEY_TYPE]}
            readOnly
          />
        </div>
        <div>
          <label className="text-xs block mb-1">Löpnummer</label>
          <input
            className="h-8 w-full border rounded px-2 bg-muted text-muted-foreground"
            value={nextSequenceNumber}
            readOnly
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="mr-3">Objekt-ID: {rentalObjectCode}</span>
        <span className="mr-3">Låssystem: {keySystemDisplayCode}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Avbryt
        </Button>
        <Button
          size="sm"
          disabled={!draftName.trim() || isSubmitting}
          onClick={handleSubmit}
        >
          Skapa
        </Button>
      </div>
    </div>
  )
}
