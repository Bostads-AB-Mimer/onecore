import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  KeyWithLoanAndEvent,
  KeyTypeLabels,
  getKeyEventDisplayLabel,
} from '@/services/types'
import type { GroupedKeys } from '@/utils/groupKeys'
import { formatAbsoluteTime } from '@/lib/dateUtils'

interface KeyBundleKeysListProps {
  group: GroupedKeys['nonDisposed'] | GroupedKeys['disposed']
  companyNames: Record<string, string>
  selectable?: boolean
  selectedKeys?: string[]
  onKeySelectionChange?: (keyId: string, checked: boolean) => void
}

/**
 * Shared component for displaying keys grouped by company and loan with collapsible company headers.
 * Can optionally include checkboxes for key selection.
 */
export function KeyBundleKeysList({
  group,
  companyNames,
  selectable = false,
  selectedKeys = [],
  onKeySelectionChange,
}: KeyBundleKeysListProps) {
  // State to track which contacts are expanded (default: all expanded)
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(group.loaned.map((cg) => cg.contact))
  )

  // State to track if unloaned section is expanded (default: expanded)
  const [unloanedExpanded, setUnloanedExpanded] = useState(true)

  const toggleCompany = (company: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(company)) {
        next.delete(company)
      } else {
        next.add(company)
      }
      return next
    })
  }

  const colSpan = selectable ? 7 : 6

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && <TableHead className="w-[50px]"></TableHead>}
            <TableHead className="w-[22%]">Nyckelnamn</TableHead>
            <TableHead className="w-[8%]">Löpnr</TableHead>
            <TableHead className="w-[8%]">Flex</TableHead>
            <TableHead className="w-[22%]">Status</TableHead>
            <TableHead className="w-[15%]">Typ</TableHead>
            <TableHead className="w-[25%]">Hyresobjekt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Loaned keys grouped by contact then loan */}
          {group.loaned.map((contactGroup) => {
            const isExpanded = expandedCompanies.has(contactGroup.contact)
            return (
              <React.Fragment key={`contact-${contactGroup.contact}`}>
                {/* Contact header row - clickable to expand/collapse */}
                <TableRow
                  className="bg-muted hover:bg-muted/80 cursor-pointer"
                  onClick={() => toggleCompany(contactGroup.contact)}
                >
                  <TableCell colSpan={colSpan} className="font-semibold py-4">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {companyNames[contactGroup.contact] ||
                        contactGroup.contact}
                    </div>
                  </TableCell>
                </TableRow>

                {/* Loans within this contact - only show if expanded */}
                {isExpanded &&
                  contactGroup.loans.map((loan: any) => (
                    <React.Fragment key={`loan-${loan.loanId}`}>
                      {/* Loan header row */}
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell
                          colSpan={colSpan}
                          className="font-medium text-sm pl-8"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">Lånad</Badge>
                            {loan.loanContactPerson && (
                              <span className="text-muted-foreground">
                                Kontakt: {loan.loanContactPerson}
                              </span>
                            )}
                            {loan.loanPickedUpAt && (
                              <span className="text-muted-foreground">
                                Upphämtad:{' '}
                                {formatAbsoluteTime(loan.loanPickedUpAt)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Key data rows for this loan */}
                      {loan.keys.map((key: KeyWithLoanAndEvent) => (
                        <KeyRow
                          key={key.id}
                          keyData={key}
                          indent={true}
                          selectable={selectable}
                          isSelected={selectedKeys.includes(key.id)}
                          onSelectionChange={onKeySelectionChange}
                        />
                      ))}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            )
          })}

          {/* Unloaned keys section */}
          {group.unloaned.length > 0 && (
            <>
              {/* Unloaned header row - clickable to expand/collapse */}
              <TableRow
                className="bg-muted hover:bg-muted/80 cursor-pointer"
                onClick={() => setUnloanedExpanded(!unloanedExpanded)}
              >
                <TableCell colSpan={colSpan} className="font-semibold py-4">
                  <div className="flex items-center gap-2">
                    {unloanedExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Ej utlånade
                  </div>
                </TableCell>
              </TableRow>

              {/* Key data rows for unloaned keys - only show if expanded */}
              {unloanedExpanded &&
                group.unloaned.map((key) => (
                  <KeyRow
                    key={key.id}
                    keyData={key}
                    indent={true}
                    selectable={selectable}
                    isSelected={selectedKeys.includes(key.id)}
                    onSelectionChange={onKeySelectionChange}
                  />
                ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Individual key row component
 */
interface KeyRowProps {
  keyData: KeyWithLoanAndEvent
  indent?: boolean
  selectable?: boolean
  isSelected?: boolean
  onSelectionChange?: (keyId: string, checked: boolean) => void
}

function KeyRow({
  keyData,
  indent = false,
  selectable = false,
  isSelected = false,
  onSelectionChange,
}: KeyRowProps) {
  return (
    <TableRow>
      {selectable && (
        <TableCell className={`w-[50px] ${indent ? 'pl-8' : ''}`}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) =>
              onSelectionChange?.(keyData.id, checked as boolean)
            }
          />
        </TableCell>
      )}
      <TableCell
        className={`font-medium w-[22%] ${!selectable && indent ? 'pl-8' : ''}`}
      >
        {keyData.keyName}
      </TableCell>
      <TableCell className="w-[8%]">
        {keyData.keySequenceNumber ?? '-'}
      </TableCell>
      <TableCell className="w-[8%]">{keyData.flexNumber ?? '-'}</TableCell>
      <TableCell className="w-[22%]">
        {keyData.latestEvent && keyData.latestEvent.status !== 'COMPLETED' ? (
          <Badge variant="outline">
            {getKeyEventDisplayLabel(keyData.latestEvent)}
          </Badge>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell className="w-[15%]">
        <Badge variant="secondary">
          {KeyTypeLabels[keyData.keyType as keyof typeof KeyTypeLabels]}
        </Badge>
      </TableCell>
      <TableCell className="w-[25%]">
        {keyData.rentalObjectCode ?? '-'}
      </TableCell>
    </TableRow>
  )
}
