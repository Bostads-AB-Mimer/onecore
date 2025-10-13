import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Minus, Loader2, AlertCircle } from 'lucide-react'
import type { Key, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { useToast } from '@/hooks/use-toast'

type KeyGroup = {
  keyName: string
  keyType: KeyType
  count: number
  sampleKey: Key
  currentFlexNumber: number
  hasFlexConflict: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedKeys: Key[]
  onSuccess?: () => void
}

export function FlexMenu({
  open,
  onOpenChange,
  selectedKeys,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)

  // Group keys by name and type, with a default count of 3
  const [keyGroups, setKeyGroups] = useState<Map<string, KeyGroup>>(new Map())

  // Initialize key groups when selectedKeys changes
  useMemo(() => {
    const groups = new Map<string, KeyGroup>()

    selectedKeys.forEach((key) => {
      const groupKey = `${key.keyName}-${key.keyType}`

      if (!groups.has(groupKey)) {
        // Find all keys in the selected set with same name and type
        const keysInGroup = selectedKeys.filter(
          (k) => k.keyName === key.keyName && k.keyType === key.keyType
        )

        // Check if all keys have the same flexNumber
        const flexNumbers = keysInGroup
          .map((k) => k.flexNumber)
          .filter((fn): fn is number => fn !== undefined)

        const uniqueFlexNumbers = new Set(flexNumbers)
        const hasFlexConflict = uniqueFlexNumbers.size > 1

        // Use the first flex number found, or 0 if none
        const currentFlexNumber = flexNumbers.length > 0 ? flexNumbers[0] : 0

        groups.set(groupKey, {
          keyName: key.keyName,
          keyType: key.keyType,
          count: 3,
          sampleKey: key,
          currentFlexNumber,
          hasFlexConflict,
        })
      }
    })

    setKeyGroups(groups)
  }, [selectedKeys])

  const incrementCount = (groupKey: string) => {
    setKeyGroups((prev) => {
      const newGroups = new Map(prev)
      const group = newGroups.get(groupKey)
      if (group) {
        newGroups.set(groupKey, { ...group, count: group.count + 1 })
      }
      return newGroups
    })
  }

  const decrementCount = (groupKey: string) => {
    setKeyGroups((prev) => {
      const newGroups = new Map(prev)
      const group = newGroups.get(groupKey)
      if (group && group.count > 0) {
        newGroups.set(groupKey, { ...group, count: group.count - 1 })
      }
      return newGroups
    })
  }

  const handleCreate = async () => {
    // Check for flex conflicts before creating
    const hasAnyConflict = Array.from(keyGroups.values()).some(
      (group) => group.hasFlexConflict
    )

    if (hasAnyConflict) {
      toast({
        title: 'Fel: Olika flex-nummer',
        description:
          'Valda nycklar med samma namn och typ har olika flex-nummer. Vänligen välj nycklar med samma flex-nummer.',
        variant: 'destructive',
      })
      return
    }

    setIsCreating(true)
    try {
      const createPromises: Promise<Key>[] = []

      // Create keys for each group
      keyGroups.forEach((group) => {
        // New flex number is current + 1 (same for all keys in this group)
        const newFlexNumber = group.currentFlexNumber + 1

        // Create 'count' number of keys with sequence numbers 1, 2, 3, etc.
        for (let i = 1; i <= group.count; i++) {
          createPromises.push(
            keyService.createKey({
              keyName: group.keyName,
              keyType: group.keyType,
              flexNumber: newFlexNumber,
              keySequenceNumber: i, // Sequence number: 1, 2, 3, etc.
              rentalObjectCode: group.sampleKey.rentalObjectCode,
              keySystemId: group.sampleKey.keySystemId,
            })
          )
        }
      })

      await Promise.all(createPromises)

      toast({
        title: 'Nycklar skapade',
        description: `${createPromises.length} flex-nycklar har skapats.`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Okänt fel'
      toast({
        title: 'Kunde inte skapa nycklar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const totalKeysToCreate = Array.from(keyGroups.values()).reduce(
    (sum, group) => sum + group.count,
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa Flex-nycklar</DialogTitle>
          <DialogDescription>
            Skapa nya nycklar med högre flex-nummer för de valda nycklarna.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left side - Selected keys (Före) */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              Före ({selectedKeys.length} valda)
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {selectedKeys.map((key) => (
                <div
                  key={key.id}
                  className="p-3 border rounded-lg bg-muted/50 text-sm"
                >
                  <div className="font-medium">{key.keyName}</div>
                  <div className="text-muted-foreground">
                    {KeyTypeLabels[key.keyType]}
                    {key.flexNumber !== undefined &&
                      ` • Flex: ${key.flexNumber}`}
                    {key.keySequenceNumber !== undefined &&
                      ` • Sekv: ${key.keySequenceNumber}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side - Keys to be created (Efter) */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              Efter ({totalKeysToCreate} nya)
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {Array.from(keyGroups.entries()).map(([groupKey, group]) => {
                const newFlexNumber = group.currentFlexNumber + 1

                return (
                  <div
                    key={groupKey}
                    className={`p-3 border rounded-lg space-y-2 ${
                      group.hasFlexConflict
                        ? 'bg-destructive/10 border-destructive'
                        : 'bg-card'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm">{group.keyName}</div>
                      <div className="text-xs text-muted-foreground">
                        {KeyTypeLabels[group.keyType]}
                      </div>
                    </div>

                    {group.hasFlexConflict ? (
                      <div className="flex items-center gap-2 text-xs text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Olika flex-nummer i valda nycklar</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Flex {newFlexNumber} • Sekvens 1-{group.count}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => decrementCount(groupKey)}
                              disabled={group.count === 0 || isCreating}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {group.count}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => incrementCount(groupKey)}
                              disabled={isCreating}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || totalKeysToCreate === 0}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Skapar...
              </>
            ) : (
              `Godkänn (${totalKeysToCreate})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
