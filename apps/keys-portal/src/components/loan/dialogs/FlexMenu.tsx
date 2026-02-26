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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  hasNullFlex: boolean
  isAtMaxFlex: boolean
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

  // Track user-specified flex for groups with null flex
  const [flexOverrides, setFlexOverrides] = useState<Map<string, number>>(
    new Map()
  )

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
        const hasNullFlex = flexNumbers.length === 0

        // Use the first flex number found, or 0 if none
        const currentFlexNumber = flexNumbers.length > 0 ? flexNumbers[0] : 0
        const isAtMaxFlex = currentFlexNumber === 3

        groups.set(groupKey, {
          keyName: key.keyName,
          keyType: key.keyType,
          count: isAtMaxFlex ? 0 : 3,
          sampleKey: key,
          currentFlexNumber,
          hasFlexConflict,
          hasNullFlex,
          isAtMaxFlex,
        })
      }
    })

    setKeyGroups(groups)
    setFlexOverrides(new Map())
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

  const handleFlexOverride = (groupKey: string, value: string) => {
    const flexNumber = parseInt(value, 10)
    setFlexOverrides((prev) => {
      const newOverrides = new Map(prev)
      newOverrides.set(groupKey, flexNumber)
      return newOverrides
    })
  }

  const getEffectiveFlexNumber = (group: KeyGroup, groupKey: string) => {
    if (group.hasNullFlex) {
      return flexOverrides.get(groupKey) ?? null
    }
    return group.currentFlexNumber
  }

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const createdKeys: Key[] = []

      // Create keys for each group (skip max-flex groups)
      for (const [groupKey, group] of keyGroups.entries()) {
        if (group.isAtMaxFlex || group.count === 0) continue

        const effectiveFlex = getEffectiveFlexNumber(group, groupKey)
        if (effectiveFlex === null) continue

        const newFlexNumber = effectiveFlex + 1

        // Create 'count' number of keys with sequence numbers 1, 2, 3, etc.
        for (let i = 1; i <= group.count; i++) {
          const newKey = await keyService.createKey({
            keyName: group.keyName,
            keyType: group.keyType,
            keySequenceNumber: i,
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

  // Only count groups that can actually create keys
  const totalKeysToCreate = Array.from(keyGroups.entries()).reduce(
    (sum, [, group]) => (group.isAtMaxFlex ? sum : sum + group.count),
    0
  )

  // Check if any null-flex group is missing a user override
  const hasUnresolvedNullFlex = Array.from(keyGroups.entries()).some(
    ([groupKey, group]) =>
      group.hasNullFlex && !group.isAtMaxFlex && !flexOverrides.has(groupKey)
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
                    {key.flexNumber != null
                      ? ` • Flex ${key.flexNumber}`
                      : ' • Flex saknas'}
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
                const effectiveFlex = getEffectiveFlexNumber(group, groupKey)
                const newFlexNumber =
                  effectiveFlex !== null ? effectiveFlex + 1 : null

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
                          Varning: Valda nycklar har olika flex-nummer
                        </div>
                      )}
                    </div>

                    {/* Max flex warning */}
                    {group.isAtMaxFlex && (
                      <div className="text-xs text-destructive">
                        Kan inte flexa – redan på flex 3
                      </div>
                    )}

                    {/* Null flex - require user to set flex */}
                    {group.hasNullFlex && !group.isAtMaxFlex && (
                      <div className="space-y-2">
                        <div className="text-xs text-destructive">
                          Flex saknas – ange nuvarande flex innan du flexar
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Nuvarande flex:
                          </span>
                          <Select
                            value={
                              flexOverrides.has(groupKey)
                                ? String(flexOverrides.get(groupKey))
                                : undefined
                            }
                            onValueChange={(v) =>
                              handleFlexOverride(groupKey, v)
                            }
                          >
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue placeholder="–" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                            </SelectContent>
                          </Select>
                          {newFlexNumber !== null && (
                            <span className="text-xs text-muted-foreground">
                              → Ny flex: {newFlexNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Normal group or null-flex with override set - show quantity controls */}
                    {!group.isAtMaxFlex &&
                      (!group.hasNullFlex || flexOverrides.has(groupKey)) && (
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
            disabled={
              isCreating || totalKeysToCreate === 0 || hasUnresolvedNullFlex
            }
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
