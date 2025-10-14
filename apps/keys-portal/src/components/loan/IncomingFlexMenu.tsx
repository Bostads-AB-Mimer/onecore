import { useState, useMemo } from 'react'
import type { Key, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { keyLoanService } from '@/services/api/keyLoanService'
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

type KeyGroup = {
  keyName: string
  keyType: KeyType
  flexNumber: number
  incomingKeys: Key[] // Keys on the left (new flex keys)
  disposableKeys: Key[] // Keys on the right (keys with lower flex number)
  selectedDisposableIds: Set<string> // Which keys to dispose
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

  // Group keys by name, type, and flex number
  const keyGroups = useMemo(() => {
    const groups = new Map<string, KeyGroup>()

    selectedKeys.forEach((key) => {
      if (key.flexNumber === undefined) return

      const groupKey = `${key.keyName}-${key.keyType}-${key.flexNumber}`

      if (!groups.has(groupKey)) {
        // Find all keys with the same name and type but lower flex number
        const disposableKeys = allKeys.filter(
          (k) =>
            k.keyName === key.keyName &&
            k.keyType === key.keyType &&
            k.flexNumber !== undefined &&
            k.flexNumber < key.flexNumber! &&
            !k.disposed // Don't show already disposed keys
        )

        // Find all incoming keys with same name, type, and flex number
        const incomingKeys = selectedKeys.filter(
          (k) =>
            k.keyName === key.keyName &&
            k.keyType === key.keyType &&
            k.flexNumber === key.flexNumber
        )

        groups.set(groupKey, {
          keyName: key.keyName,
          keyType: key.keyType,
          flexNumber: key.flexNumber,
          incomingKeys,
          disposableKeys,
          selectedDisposableIds: new Set<string>(),
        })
      }
    })

    return Array.from(groups.values())
  }, [selectedKeys, allKeys])

  const [groupSelections, setGroupSelections] = useState<
    Map<string, Set<string>>
  >(new Map())

  // Initialize selections when groups change - precheck all disposable keys
  useMemo(() => {
    const newSelections = new Map<string, Set<string>>()
    keyGroups.forEach((group) => {
      const groupKey = `${group.keyName}-${group.keyType}-${group.flexNumber}`
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

      // Collect all selected disposable keys
      keyGroups.forEach((group) => {
        const groupKey = `${group.keyName}-${group.keyType}-${group.flexNumber}`
        const selectedIds = groupSelections.get(groupKey) || new Set()
        selectedIds.forEach((id) => allDisposableKeyIds.push(id))
      })

      if (allDisposableKeyIds.length === 0) {
        toast({
          title: 'Ingen nyckel vald',
          description:
            'Vänligen välj minst en nyckel att markera som kasserad.',
          variant: 'destructive',
        })
        setIsProcessing(false)
        return
      }

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
        const loan = await keyLoanService.get(loanId)

        // Parse the keys field - it could be a JSON array string or comma-separated string
        let keyIds: string[] = []
        if (loan.keys) {
          try {
            // Try parsing as JSON array first
            const parsed = JSON.parse(loan.keys)
            keyIds = Array.isArray(parsed) ? parsed : []
          } catch {
            // Fall back to comma-separated string
            keyIds = loan.keys.split(',').map((id) => id.trim())
          }
        }

        if (keyIds.length === 0) continue

        // Get all keys in this loan
        const keysInLoan = await Promise.all(
          keyIds.map((keyId) => keyService.getKey(keyId))
        )

        // Check if all keys are disposed
        const allDisposed = keysInLoan.every((key) => key.disposed === true)

        if (allDisposed) {
          // Mark the loan as returned
          await keyLoanService.update(loanId, {
            returnedAt: new Date().toISOString(),
          })
        }
      }

      toast({
        title: 'Nycklar kasserade',
        description: `${allDisposableKeyIds.length} nyckel/nycklar har markerats som kasserade.`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Okänt fel'
      toast({
        title: 'Kunde inte kassera nycklar',
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

  if (keyGroups.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inkommen flex</DialogTitle>
            <DialogDescription>
              Inga flex-nycklar valda eller inga nycklar att kassera.
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
        const groupKey = `${group.keyName}-${group.keyType}-${group.flexNumber}`
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
                        {key.flexNumber !== undefined &&
                          `Flex: ${key.flexNumber}`}
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
      description="Markera de nycklar som ska kasseras när de nya flex-nycklarna har kommit in."
      selectedKeys={selectedKeys}
      leftTitle={`Inkommande (${selectedKeys.length} valda)`}
      rightTitle={`Kassera (${totalSelectedKeys} valda)`}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={handleAccept}
      acceptButtonText="Kasserar"
      totalCount={totalSelectedKeys}
    />
  )
}
