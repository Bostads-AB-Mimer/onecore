import { useMemo, useEffect, useState } from 'react'
import type { KeyDetails, KeyLoanWithDetails } from '@/services/types'
import { getActiveLoan, getLatestLoan } from '@/utils/loanHelpers'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { useItemSelection } from '@/hooks/useItemSelection'
import { KeyActionButtons } from '@/components/shared/KeyActionButtons'
import { ReturnMaintenanceKeysDialog } from './dialogs/ReturnMaintenanceKeysDialog'
import { LoanMaintenanceKeysDialog } from './dialogs/LoanMaintenanceKeysDialog'
import { FlexMenu } from '@/components/loan/dialogs/FlexMenu'
import { IncomingFlexMenu } from '@/components/loan/dialogs/IncomingFlexMenu'
import { updateKeyBundle } from '@/services/api/keyBundleService'
import { useToast } from '@/hooks/use-toast'
import { Minus } from 'lucide-react'
import { handleDisposeKeys } from '@/services/loanHandlers'
import { KeyBundleKeysList } from '@/components/shared/KeyBundleKeysList'
import { ConfirmDialog } from '@/components/shared/dialogs/ConfirmDialog'

interface KeyBundleKeysTableProps {
  keys: KeyDetails[]
  bundleId: string
  onRefresh: () => void
}

export function KeyBundleKeysTable({
  keys,
  bundleId,
  onRefresh,
}: KeyBundleKeysTableProps) {
  const { toast } = useToast()
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})
  const keySelection = useItemSelection()
  const [isProcessing, setIsProcessing] = useState(false)

  // Split keys into disposed and non-disposed
  const nonDisposedKeys = useMemo(() => keys.filter((k) => !k.disposed), [keys])
  const disposedKeys = useMemo(() => keys.filter((k) => k.disposed), [keys])

  // Alert dialog state for removing keys with active loans
  const [showRemoveWarning, setShowRemoveWarning] = useState(false)

  // Dialog states
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showLoanDialog, setShowLoanDialog] = useState(false)
  const [showFlexMenu, setShowFlexMenu] = useState(false)
  const [showIncomingFlexMenu, setShowIncomingFlexMenu] = useState(false)

  // Track key IDs for return from action menu (separate from selection-based return)
  const [pendingReturnKeyIds, setPendingReturnKeyIds] = useState<string[]>([])

  // Handler for returning keys from the loan action menu
  const handleReturnFromMenu = (loan: KeyLoanWithDetails) => {
    const keyIds = loan.keysArray?.map((k) => k.id) || []

    // Check if keys have active MAINTENANCE loans
    const keysToReturn = keys.filter((k) => keyIds.includes(k.id))
    const hasReturnableMaintenance = keysToReturn.some((k) => {
      const activeLoan = getActiveLoan(k)
      return activeLoan !== null && activeLoan.loanType === 'MAINTENANCE'
    })

    if (!hasReturnableMaintenance) {
      toast({
        title: 'Kan inte återlämna här',
        description:
          'Detta är inte ett servicelån. Gå till utlåningssidan för kontraktet för att återlämna.',
        variant: 'destructive',
      })
      return
    }

    setPendingReturnKeyIds(keyIds)
    setShowReturnDialog(true)
  }

  // Fetch company names for all unique company codes
  useEffect(() => {
    const fetchCompanyNames = async () => {
      const uniqueCompanyCodes = new Set<string>()

      // Collect all unique contact codes from keys with any loan (active or previous)
      keys.forEach((key) => {
        const latestLoan = getLatestLoan(key)
        if (latestLoan?.contact) {
          uniqueCompanyCodes.add(latestLoan.contact)
        }
      })

      // Fetch contact info for each company code
      const names: Record<string, string> = {}
      await Promise.all(
        Array.from(uniqueCompanyCodes).map(async (companyCode) => {
          const contact = await fetchContactByContactCode(companyCode)
          if (contact) {
            // Format: Name · Code · NationalRegistrationNumber
            const parts = [contact.fullName, companyCode]
            if (contact.nationalRegistrationNumber) {
              parts.push(contact.nationalRegistrationNumber)
            }
            names[companyCode] = parts.join(' · ')
          }
        })
      )

      setCompanyNames(names)
    }

    fetchCompanyNames()
  }, [keys])

  if (keys.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Inga nycklar i denna nyckelsamling
      </p>
    )
  }

  const hasNonDisposed = nonDisposedKeys.length > 0
  const hasDisposed = disposedKeys.length > 0

  // Get selected keys data
  const selectedKeysData = keys.filter((k) => keySelection.isSelected(k.id))

  // Determine which keys can be returned (currently loaned with MAINTENANCE type)
  const returnableKeys = selectedKeysData.filter((k) => {
    const activeLoan = getActiveLoan(k)
    return activeLoan !== null && activeLoan.loanType === 'MAINTENANCE'
  })

  // Determine which keys can be loaned (not currently loaned)
  const loanableKeys = selectedKeysData.filter((k) => {
    const activeLoan = getActiveLoan(k)
    return activeLoan === null
  })

  // Keys with active loans among selected keys
  const selectedKeysWithActiveLoans = selectedKeysData.filter(
    (k) => getActiveLoan(k) !== null
  )

  // Action handlers
  const handleRemoveFromBundleClick = () => {
    if (selectedKeysWithActiveLoans.length > 0) {
      setShowRemoveWarning(true)
    } else {
      handleRemoveFromBundle()
    }
  }

  const handleRemoveFromBundle = async () => {
    setShowRemoveWarning(false)
    setIsProcessing(true)
    try {
      // Get current bundle keys
      const currentKeyIds = keys.map((k) => k.id)
      // Remove selected keys
      const updatedKeyIds = currentKeyIds.filter(
        (id) => !keySelection.isSelected(id)
      )

      await updateKeyBundle(bundleId, {
        keys: updatedKeyIds,
      })

      toast({
        title: 'Nycklar borttagna',
        description: `${keySelection.selectedIds.length} ${keySelection.selectedIds.length === 1 ? 'nyckel' : 'nycklar'} borttagen från samlingen`,
      })

      keySelection.deselectAll()
      onRefresh()
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort nycklar från samlingen',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispose = async () => {
    setIsProcessing(true)
    const result = await handleDisposeKeys({ keyIds: keySelection.selectedIds })

    if (result.success) {
      toast({
        title: result.title,
        description: result.message,
      })
      keySelection.deselectAll()
      onRefresh()
    } else {
      toast({
        title: result.title,
        description: result.message,
        variant: 'destructive',
      })
    }
    setIsProcessing(false)
  }

  return (
    <>
      {/* Action buttons */}
      <div className="mb-4">
        <KeyActionButtons
          selectedCount={keySelection.selectedIds.length}
          isProcessing={isProcessing}
          loanAction={
            loanableKeys.length > 0
              ? {
                  label: 'Låna ut',
                  count: loanableKeys.length,
                  onClick: () => setShowLoanDialog(true),
                }
              : undefined
          }
          returnAction={
            returnableKeys.length > 0
              ? {
                  label: 'Återlämna',
                  count: returnableKeys.length,
                  onClick: () => setShowReturnDialog(true),
                }
              : undefined
          }
          flexAction={{
            label: 'Flex',
            onClick: () => setShowFlexMenu(true),
          }}
          disposeAction={{
            label: 'Kassera',
            onClick: handleDispose,
          }}
          customActions={[
            {
              label: 'Ta bort från samling',
              variant: 'outline',
              icon: <Minus className="h-3 w-3" />,
              onClick: handleRemoveFromBundleClick,
            },
          ]}
        />
      </div>

      <div className="space-y-6">
        {/* Aktiva nycklar table */}
        {hasNonDisposed && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-green-600">
              Aktiva nycklar
            </h3>
            <KeyBundleKeysList
              keys={nonDisposedKeys}
              companyNames={companyNames}
              selectable={true}
              selectedKeys={keySelection.selectedIds}
              onKeySelectionChange={(keyId, checked) => {
                if (checked) keySelection.select(keyId)
                else keySelection.deselect(keyId)
              }}
              onSelectAll={() =>
                keySelection.selectAll(nonDisposedKeys.map((k) => k.id))
              }
              onDeselectAll={() => keySelection.deselectAll()}
              onRefresh={onRefresh}
              onReturn={handleReturnFromMenu}
            />
          </div>
        )}

        {/* Kasserade nycklar table */}
        {hasDisposed ? (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
              Kasserade nycklar
            </h3>
            <KeyBundleKeysList
              keys={disposedKeys}
              companyNames={companyNames}
              selectable={true}
              selectedKeys={keySelection.selectedIds}
              onKeySelectionChange={(keyId, checked) => {
                if (checked) keySelection.select(keyId)
                else keySelection.deselect(keyId)
              }}
              onSelectAll={() =>
                keySelection.selectAll(disposedKeys.map((k) => k.id))
              }
              onDeselectAll={() => keySelection.deselectAll()}
              onRefresh={onRefresh}
              onReturn={handleReturnFromMenu}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Inga kasserade nycklar
          </p>
        )}
      </div>

      {/* Dialogs */}
      <LoanMaintenanceKeysDialog
        open={showLoanDialog}
        onOpenChange={setShowLoanDialog}
        keys={loanableKeys}
        allBundleKeys={keys}
        onSuccess={() => {
          keySelection.deselectAll()
          onRefresh()
        }}
      />

      <ReturnMaintenanceKeysDialog
        open={showReturnDialog}
        onOpenChange={(open) => {
          setShowReturnDialog(open)
          if (!open) setPendingReturnKeyIds([])
        }}
        keyIds={
          pendingReturnKeyIds.length > 0
            ? pendingReturnKeyIds
            : returnableKeys.map((k) => k.id)
        }
        allKeys={keys}
        onSuccess={() => {
          keySelection.deselectAll()
          setPendingReturnKeyIds([])
          onRefresh()
        }}
      />

      <FlexMenu
        open={showFlexMenu}
        onOpenChange={setShowFlexMenu}
        selectedKeys={selectedKeysData}
        onSuccess={onRefresh}
        onKeysCreated={async (createdKeyIds) => {
          // Add the newly created flex keys to the bundle
          try {
            const currentKeyIds = keys.map((k) => k.id)
            const updatedKeyIds = [...currentKeyIds, ...createdKeyIds]

            await updateKeyBundle(bundleId, {
              keys: updatedKeyIds,
            })

            toast({
              title: 'Flex-nycklar tillagda',
              description: `${createdKeyIds.length} nya flex-nycklar har lagts till i samlingen`,
            })
          } catch (error) {
            toast({
              title: 'Kunde inte lägga till flex-nycklar',
              description:
                'Flex-nycklarna skapades men kunde inte läggas till i samlingen',
              variant: 'destructive',
            })
          }
        }}
      />

      <IncomingFlexMenu
        open={showIncomingFlexMenu}
        onOpenChange={setShowIncomingFlexMenu}
        selectedKeys={selectedKeysData}
        allKeys={keys}
        onSuccess={onRefresh}
      />

      <ConfirmDialog
        open={showRemoveWarning}
        onOpenChange={setShowRemoveWarning}
        title="Nycklar med aktiva lån"
        description={
          <div className="space-y-2">
            <p>
              {selectedKeysWithActiveLoans.length === 1
                ? 'En av de valda nycklarna har ett aktivt lån:'
                : `${selectedKeysWithActiveLoans.length} av de valda nycklarna har aktiva lån:`}
            </p>
            <ul className="list-disc pl-5 text-sm">
              {selectedKeysWithActiveLoans.map((k) => (
                <li key={k.id}>{k.keyName}</li>
              ))}
            </ul>
            <p>Vill du ändå ta bort dem från samlingen?</p>
          </div>
        }
        confirmLabel="Ta bort ändå"
        onConfirm={handleRemoveFromBundle}
      />
    </>
  )
}
