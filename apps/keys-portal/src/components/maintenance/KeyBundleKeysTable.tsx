import { useMemo, useEffect, useState } from 'react'
import type { KeyWithMaintenanceLoanStatus, Contact } from '@/services/types'
import { groupAndSortKeys, type GroupedKeys } from '@/utils/groupKeys'
import { KeyTypeLabels, getKeyEventDisplayLabel } from '@/services/types'
import { getMaintenanceKeyDisplayStatus } from '@/utils/maintenanceKeyStatusHelpers'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { formatAbsoluteTime } from '@/lib/dateUtils'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { KeyActionButtons } from '@/components/shared/KeyActionButtons'
import { ReturnMaintenanceKeysDialog } from './dialogs/ReturnMaintenanceKeysDialog'
import { LoanMaintenanceKeysDialog } from './dialogs/LoanMaintenanceKeysDialog'
import { CreateMaintenanceLoanDialog } from './CreateMaintenanceLoanDialog'
import { FlexMenu } from '@/components/loan/dialogs/FlexMenu'
import { IncomingFlexMenu } from '@/components/loan/dialogs/IncomingFlexMenu'
import { updateKeyBundle } from '@/services/api/keyBundleService'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Minus } from 'lucide-react'
import { handleDisposeKeys } from '@/services/loanHandlers'

interface KeyBundleKeysTableProps {
  keys: KeyWithMaintenanceLoanStatus[]
  bundleName: string
  bundleId: string
  onRefresh: () => void
}

export function KeyBundleKeysTable({
  keys,
  bundleName,
  bundleId,
  onRefresh,
}: KeyBundleKeysTableProps) {
  const { toast } = useToast()
  const grouped = useMemo(() => groupAndSortKeys(keys), [keys])
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Dialog states
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showLoanDialog, setShowLoanDialog] = useState(false)
  const [showFlexMenu, setShowFlexMenu] = useState(false)
  const [showIncomingFlexMenu, setShowIncomingFlexMenu] = useState(false)

  // Fetch company names for all unique company codes
  useEffect(() => {
    const fetchCompanyNames = async () => {
      const uniqueCompanyCodes = new Set<string>()

      // Collect all unique company codes from loaned keys
      grouped.nonDisposed.loaned.forEach((companyGroup) => {
        if (companyGroup.company) uniqueCompanyCodes.add(companyGroup.company)
      })
      grouped.disposed.loaned.forEach((companyGroup) => {
        if (companyGroup.company) uniqueCompanyCodes.add(companyGroup.company)
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
  }, [grouped])

  if (keys.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Inga nycklar i denna nyckelsamling
        </CardContent>
      </Card>
    )
  }

  const hasNonDisposed =
    grouped.nonDisposed.loaned.length > 0 ||
    grouped.nonDisposed.unloaned.length > 0
  const hasDisposed =
    grouped.disposed.loaned.length > 0 || grouped.disposed.unloaned.length > 0

  // Get selected keys data
  const selectedKeysData = keys.filter((k) => selectedKeys.includes(k.id))

  // Determine which keys can be returned (currently loaned)
  const returnableKeys = selectedKeysData.filter(
    (k) => k.maintenanceLoan !== null
  )

  // Determine which keys can be loaned (not currently loaned)
  const loanableKeys = selectedKeysData.filter(
    (k) => k.maintenanceLoan === null
  )

  // Action handlers
  const handleRemoveFromBundle = async () => {
    setIsProcessing(true)
    try {
      // Get current bundle keys
      const currentKeyIds = keys.map((k) => k.id)
      // Remove selected keys
      const updatedKeyIds = currentKeyIds.filter(
        (id) => !selectedKeys.includes(id)
      )

      await updateKeyBundle(bundleId, {
        keys: JSON.stringify(updatedKeyIds),
      })

      toast({
        title: 'Nycklar borttagna',
        description: `${selectedKeys.length} ${selectedKeys.length === 1 ? 'nyckel' : 'nycklar'} borttagen från samlingen`,
      })

      setSelectedKeys([])
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
    const result = await handleDisposeKeys({ keyIds: selectedKeys })

    if (result.success) {
      toast({
        title: result.title,
        description: result.message,
      })
      setSelectedKeys([])
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
    <Card>
      <CardHeader>
        <CardTitle>Nycklar i {bundleName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Totalt {keys.length} nycklar
        </p>

        {/* Action buttons */}
        <div className="pt-3">
          <KeyActionButtons
            selectedCount={selectedKeys.length}
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
                onClick: handleRemoveFromBundle,
              },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Aktiva nycklar table */}
          {hasNonDisposed && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-green-600">
                Aktiva nycklar
              </h3>
              {renderUnifiedTable(
                grouped.nonDisposed,
                companyNames,
                selectedKeys,
                setSelectedKeys
              )}
            </div>
          )}

          {/* Kasserade nycklar table */}
          {hasDisposed ? (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                Kasserade nycklar
              </h3>
              {renderUnifiedTable(
                grouped.disposed,
                companyNames,
                selectedKeys,
                setSelectedKeys
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Inga kasserade nycklar
            </p>
          )}
        </div>
      </CardContent>

      {/* Dialogs */}
      <LoanMaintenanceKeysDialog
        open={showLoanDialog}
        onOpenChange={setShowLoanDialog}
        keys={loanableKeys}
        allBundleKeys={keys}
        onSuccess={() => {
          setSelectedKeys([])
          onRefresh()
        }}
      />

      <ReturnMaintenanceKeysDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        keyIds={returnableKeys.map((k) => k.id)}
        allKeys={keys}
        onSuccess={() => {
          setSelectedKeys([])
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
              keys: JSON.stringify(updatedKeyIds),
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
    </Card>
  )
}

/**
 * Renders a single key row with all columns
 */
function renderKeyRow(
  key: KeyWithMaintenanceLoanStatus,
  selectedKeys: string[],
  setSelectedKeys: React.Dispatch<React.SetStateAction<string[]>>,
  indent: boolean = false
) {
  return (
    <TableRow key={key.id}>
      <TableCell className={`w-[50px] ${indent ? 'pl-8' : ''}`}>
        <Checkbox
          checked={selectedKeys.includes(key.id)}
          onCheckedChange={(checked) => {
            setSelectedKeys((prev) =>
              checked ? [...prev, key.id] : prev.filter((id) => id !== key.id)
            )
          }}
        />
      </TableCell>
      <TableCell className="font-medium w-[22%]">{key.keyName}</TableCell>
      <TableCell className="w-[8%]">{key.keySequenceNumber ?? '-'}</TableCell>
      <TableCell className="w-[8%]">{key.flexNumber ?? '-'}</TableCell>
      <TableCell className="w-[22%]">
        {(() => {
          const { status, statusColor } = getMaintenanceKeyDisplayStatus(key)
          return <span className={`font-medium ${statusColor}`}>{status}</span>
        })()}
      </TableCell>
      <TableCell className="w-[15%]">
        <Badge variant="secondary">
          {KeyTypeLabels[key.keyType as keyof typeof KeyTypeLabels]}
        </Badge>
      </TableCell>
      <TableCell className="w-[25%]">{key.rentalObjectCode ?? '-'}</TableCell>
    </TableRow>
  )
}

/**
 * Renders a unified table with grouping rows for companies, loans, and unloaned keys
 */
function renderUnifiedTable(
  group: GroupedKeys['nonDisposed'],
  companyNames: Record<string, string>,
  selectedKeys: string[],
  setSelectedKeys: React.Dispatch<React.SetStateAction<string[]>>
) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="w-[22%]">Nyckelnamn</TableHead>
            <TableHead className="w-[8%]">Löpnr</TableHead>
            <TableHead className="w-[8%]">Flex</TableHead>
            <TableHead className="w-[22%]">Status</TableHead>
            <TableHead className="w-[15%]">Typ</TableHead>
            <TableHead className="w-[25%]">Hyresobjekt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Loaned keys grouped by company then loan */}
          {group.loaned.map((companyGroup) => (
            <>
              {/* Company header row */}
              <TableRow
                key={`company-${companyGroup.company}`}
                className="bg-muted hover:bg-muted"
              >
                <TableCell colSpan={7} className="font-semibold py-4">
                  {companyNames[companyGroup.company] || companyGroup.company}
                </TableCell>
              </TableRow>

              {/* Loans within this company */}
              {companyGroup.loans.map((loan) => (
                <>
                  {/* Loan header row */}
                  <TableRow
                    key={`loan-${loan.loanId}`}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    <TableCell colSpan={7} className="font-medium text-sm pl-8">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">Lånad</Badge>
                        {loan.loanContactPerson && (
                          <span className="text-muted-foreground">
                            Kontakt: {loan.loanContactPerson}
                          </span>
                        )}
                        {loan.loanPickedUpAt && (
                          <span className="text-muted-foreground">
                            Upphämtad: {formatAbsoluteTime(loan.loanPickedUpAt)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Key data rows for this loan */}
                  {loan.keys.map((key) =>
                    renderKeyRow(key, selectedKeys, setSelectedKeys, true)
                  )}
                </>
              ))}
            </>
          ))}

          {/* Unloaned keys section */}
          {group.unloaned.length > 0 && (
            <>
              {/* Unloaned header row */}
              <TableRow className="bg-muted hover:bg-muted">
                <TableCell colSpan={7} className="font-semibold py-4">
                  Ej utlånade
                </TableCell>
              </TableRow>

              {/* Key data rows for unloaned keys */}
              {group.unloaned.map((key) =>
                renderKeyRow(key, selectedKeys, setSelectedKeys, true)
              )}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
