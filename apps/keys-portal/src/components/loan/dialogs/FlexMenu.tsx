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
import { Plus, Minus } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { Key, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { keyEventService } from '@/services/api/keyEventService'
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
  onKeysCreated?: (createdKeyIds: string[]) => void
}

export function FlexMenu({
  open,
  onOpenChange,
  selectedKeys,
  onSuccess,
  onKeysCreated,
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
          .filter((fn): fn is number => fn !== null && fn !== undefined)

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
    setIsCreating(true)
    try {
      const createdKeys: Key[] = []

      // Calculate total keys to create across all groups
      let totalKeysToCreate = 0
      for (const group of keyGroups.values()) {
        totalKeysToCreate += group.count
      }

      // Create keys for each group
      for (const group of keyGroups.values()) {
        // Calculate the new flex number (current + 1)
        const currentFlexNumber = group.currentFlexNumber ?? 0
        const newFlexNumber = currentFlexNumber + 1

        // Create 'count' number of keys with sequence numbers 1, 2, 3, etc.
        for (let i = 1; i <= group.count; i++) {
          const newKey = await keyService.createKey({
            keyName: group.keyName,
            keyType: group.keyType,
            keySequenceNumber: i, // Sequence number: 1, 2, 3, etc.
            flexNumber: newFlexNumber,
            rentalObjectCode: group.sampleKey.rentalObjectCode,
            keySystemId: group.sampleKey.keySystemId,
          })
          createdKeys.push(newKey)
        }
      }

      // Create a single FLEX event for all created keys with ORDERED status
      const keyIds = createdKeys.map((k) => k.id)
      await keyEventService.createFlexOrder(keyIds)

      toast({
        title: 'Flex-nycklar skapade',
        description: `${createdKeys.length} flex-nycklar har beställts.`,
      })

      // Call onKeysCreated with the IDs of the created keys
      if (onKeysCreated) {
        onKeysCreated(keyIds)
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Okänt fel'
      toast({
        title: 'Kunde inte skapa flex-nycklar',
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
            Skapa nya flex-nycklar för de valda nycklarna.
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
                      ` • Flex ${key.flexNumber}`}
                    {key.keySequenceNumber !== undefined &&
                      ` • Löpnr: ${key.keySequenceNumber}`}
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
                    className="p-3 border rounded-lg space-y-2 bg-card"
                  >
                    <div>
                      <div className="font-medium text-sm">{group.keyName}</div>
                      <div className="text-xs text-muted-foreground">
                        {KeyTypeLabels[group.keyType]}
                      </div>
                      {group.hasFlexConflict && (
                        <div className="text-xs text-destructive mt-1">
                          ⚠️ Varning: Valda nycklar har olika flex-nummer
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Flex {newFlexNumber} • Löpnr 1-{group.count}
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
                <Spinner size="sm" />
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
