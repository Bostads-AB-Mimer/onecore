import { useState, useMemo, useEffect } from 'react'
import type {
  Key,
  KeyType,
  KeyEvent,
  KeyLoanWithDetails,
} from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyEventService } from '@/services/api/keyEventService'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { BeforeAfterDialogBase } from './BeforeAfterDialogBase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

type KeyGroup = {
  keyName: string
  keyType: KeyType
  incomingKeys: Key[] // Keys on the left (keys with ORDERED event)
  disposableKeys: Key[] // Keys on the right (keys to dispose)
  selectedDisposableIds: Set<string> // Which keys to dispose
  eventId?: string // The event ID to update
  incomingFlexNumber?: number // The flex number of incoming keys
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedKeys: Key[]
  allKeys: Key[]
  onSuccess?: () => void
}

export function IncomingFlexMenu({
  open,
  onOpenChange,
  selectedKeys,
  allKeys,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [keyEvents, setKeyEvents] = useState<Map<string, KeyEvent>>(new Map())

  // Fetch events for selected keys
  useEffect(() => {
    if (!open || selectedKeys.length === 0) return

    const fetchEvents = async () => {
      setIsLoadingEvents(true)
      try {
        const keyIds = selectedKeys.map((k) => k.id)
        const eventMap = await keyEventService.getLatestForKeys(keyIds)
        setKeyEvents(eventMap)
      } catch (error) {
        console.error('Failed to fetch key events:', error)
      } finally {
        setIsLoadingEvents(false)
      }
    }

    fetchEvents()
  }, [open, selectedKeys])

  // Group keys by name and type
  const keyGroups = useMemo(() => {
    const groups = new Map<string, KeyGroup>()

    selectedKeys.forEach((key) => {
      const latestEvent = keyEvents.get(key.id)

      // Only process keys that have an ORDERED event
      if (!latestEvent || latestEvent.status !== 'ORDERED') return

      const groupKey = `${key.keyName}-${key.keyType}`

      if (!groups.has(groupKey)) {
        // Find all incoming keys with same name and type from selectedKeys
        const incomingKeys = selectedKeys.filter(
          (k) => k.keyName === key.keyName && k.keyType === key.keyType
        )

        // Get the flex number of the incoming keys (should all be the same)
        const incomingFlexNumber = key.flexNumber

        // Find all keys with the same name and type from allKeys that should be disposed
        // Only include keys with null or lower flex numbers
        const disposableKeys = allKeys.filter(
          (k) =>
            k.keyName === key.keyName &&
            k.keyType === key.keyType &&
            k.id !== key.id &&
            !k.disposed && // Don't show already disposed keys
            (k.flexNumber === null ||
              k.flexNumber === undefined ||
              (incomingFlexNumber !== null &&
                incomingFlexNumber !== undefined &&
                k.flexNumber < incomingFlexNumber))
        )

        groups.set(groupKey, {
          keyName: key.keyName,
          keyType: key.keyType,
          incomingKeys,
          disposableKeys,
          selectedDisposableIds: new Set<string>(),
          eventId: latestEvent.id,
          incomingFlexNumber,
        })
      }
    })

    return Array.from(groups.values())
  }, [selectedKeys, allKeys, keyEvents])

  const [groupSelections, setGroupSelections] = useState<
    Map<string, Set<string>>
  >(new Map())

  // Initialize selections when groups change - precheck all disposable keys
  useMemo(() => {
    const newSelections = new Map<string, Set<string>>()
    keyGroups.forEach((group) => {
      const groupKey = `${group.keyName}-${group.keyType}`
      // Precheck all disposable keys by default
      const selectedIds = new Set(group.disposableKeys.map((key) => key.id))
      newSelections.set(groupKey, selectedIds)
    })
    setGroupSelections(newSelections)
  }, [keyGroups])

  const toggleKeySelection = (
    groupKey: string,
    keyId: string,
    checked: boolean
  ) => {
    setGroupSelections((prev) => {
      const newSelections = new Map(prev)
      const groupSet = new Set(newSelections.get(groupKey) || [])
      if (checked) {
        groupSet.add(keyId)
      } else {
        groupSet.delete(keyId)
      }
      newSelections.set(groupKey, groupSet)
      return newSelections
    })
  }

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      const allDisposableKeyIds: string[] = []
      const eventIdsToUpdate = new Set<string>()

      // Collect all selected disposable keys and event IDs
      keyGroups.forEach((group) => {
        const groupKey = `${group.keyName}-${group.keyType}`
        const selectedIds = groupSelections.get(groupKey) || new Set()
        selectedIds.forEach((id) => allDisposableKeyIds.push(id))

        if (group.eventId) {
          eventIdsToUpdate.add(group.eventId)
        }
      })

      // Update all events from ORDERED to RECEIVED
      await Promise.all(
        Array.from(eventIdsToUpdate).map((eventId) =>
          keyEventService.updateStatus(eventId, 'RECEIVED')
        )
      )

      // If there are disposable keys, update them
      if (allDisposableKeyIds.length > 0) {
        // Update all selected keys to disposed = true
        await Promise.all(
          allDisposableKeyIds.map((keyId) =>
            keyService.updateKey(keyId, { disposed: true })
          )
        )

        // Check if any key loans need to be marked as returned
        const keyLoansToCheck = new Set<string>()

        // Find all key loans for the disposed keys
        for (const keyId of allDisposableKeyIds) {
          const loans = await keyLoanService.getByKeyId(keyId)
          // Add unreturned loans
          loans.forEach((loan) => {
            if (!loan.returnedAt) {
              keyLoansToCheck.add(loan.id)
            }
          })
        }

        // For each key loan, check if all keys are now disposed
        for (const loanId of keyLoansToCheck) {
          // Fetch loan with key details
          const loan = (await keyLoanService.get(loanId, {
            includeKeySystem: true,
          })) as KeyLoanWithDetails

          const keysInLoan = loan.keysArray || []
          if (keysInLoan.length === 0) continue

          // Check if all keys are disposed
          const allDisposed = keysInLoan.every((key) => key.disposed === true)

          if (allDisposed) {
            // Mark the loan as returned
            await keyLoanService.update(loanId, {
              returnedAt: new Date().toISOString(),
            })
          }
        }
      }

      toast({
        title: 'Flex-nycklar inkomna',
        description:
          allDisposableKeyIds.length > 0
            ? `Flex-nycklar har markerats som inkomna och ${allDisposableKeyIds.length} nyckel/nycklar har kassera ts.`
            : 'Flex-nycklar har markerats som inkomna.',
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Okänt fel'
      toast({
        title: 'Kunde inte markera flex som inkommen',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const totalSelectedKeys = Array.from(groupSelections.values()).reduce(
    (sum, set) => sum + set.size,
    0
  )

  if (isLoadingEvents) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inkommen flex</DialogTitle>
            <DialogDescription>Laddar händelser...</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (keyGroups.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inkommen flex</DialogTitle>
            <DialogDescription>
              Inga beställda flex-nycklar valda (nycklar måste ha status
              "Beställd").
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Render right side content with checkboxes for disposable keys
  const rightContent = (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {keyGroups.map((group) => {
        const groupKey = `${group.keyName}-${group.keyType}`
        const selectedIds = groupSelections.get(groupKey) || new Set()

        return (
          <div
            key={groupKey}
            className="p-3 border rounded-lg bg-card space-y-2"
          >
            <div>
              <div className="font-medium text-sm">{group.keyName}</div>
              <div className="text-xs text-muted-foreground">
                {KeyTypeLabels[group.keyType]}
                {group.incomingFlexNumber !== undefined &&
                  ` • Inkommer Flex ${group.incomingFlexNumber}`}
              </div>
            </div>

            {group.disposableKeys.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                Inga nycklar att kassera
              </div>
            ) : (
              <div className="space-y-1">
                {group.disposableKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.has(key.id)}
                      onCheckedChange={(checked) =>
                        toggleKeySelection(groupKey, key.id, checked === true)
                      }
                    />
                    <div className="flex-1 text-xs">
                      <div className="text-muted-foreground">
                        {key.flexNumber !== undefined && key.flexNumber !== null
                          ? `Flex ${key.flexNumber}`
                          : 'Flex -'}
                        {key.keySequenceNumber !== undefined &&
                          ` • Sekv: ${key.keySequenceNumber}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Inkommen flex"
      description="Markera flex-nycklarna som inkomna och välj vilka nycklar som ska kasseras."
      selectedKeys={selectedKeys}
      leftTitle={`Inkommande (${selectedKeys.length} valda)`}
      rightTitle={`Kassera (${totalSelectedKeys} valda)`}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={handleAccept}
      acceptButtonText="Markera som inkommen"
      totalCount={totalSelectedKeys}
    />
  )
}
