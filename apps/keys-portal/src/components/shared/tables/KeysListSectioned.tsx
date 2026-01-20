import { useMemo, useState, useEffect } from 'react'
import {
  TableCell,
  TableHead,
  TableRow,
  TableLink,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CollapsibleGroupTable } from './CollapsibleGroupTable'
import { KeyTypeBadge, DisposedBadge } from './StatusBadges'
import type { Key } from '@/services/types'
import { rentalObjectSearchService } from '@/services/api/rentalObjectSearchService'

interface KeysListSectionedProps {
  keys: Key[]
  /** Initial expanded state for groups. Default: 'none' (collapsed) */
  initialExpanded?: 'all' | 'none'
  /** Custom className for the table wrapper */
  className?: string
  /** Whether to indent the first column (for nested tables). Default: false */
  indent?: boolean
}

/** Table displaying keys grouped by rental object code with collapsible sections */
export function KeysListSectioned({
  keys,
  initialExpanded = 'none',
  className = '',
  indent = false,
}: KeysListSectionedProps) {
  const [addressMap, setAddressMap] = useState<Record<string, string>>({})
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false)

  // Sort keys by rentalObjectCode
  const sortedKeys = useMemo(
    () =>
      [...keys].sort((a, b) => {
        const codeA = a.rentalObjectCode || ''
        const codeB = b.rentalObjectCode || ''
        return codeA.localeCompare(codeB)
      }),
    [keys]
  )

  // Fetch addresses for all rental object codes
  useEffect(() => {
    const fetchAddresses = async () => {
      if (keys.length === 0) {
        setAddressMap({})
        return
      }

      setIsLoadingAddresses(true)
      try {
        const rentalObjectCodes = [
          ...new Set(
            keys
              .map((key) => key.rentalObjectCode)
              .filter((code): code is string => code != null && code !== '')
          ),
        ]

        if (rentalObjectCodes.length > 0) {
          const addresses =
            await rentalObjectSearchService.getAddressesByRentalIds(
              rentalObjectCodes
            )
          setAddressMap(addresses)
        }
      } catch (error) {
        console.error('Failed to fetch addresses:', error)
        setAddressMap({})
      } finally {
        setIsLoadingAddresses(false)
      }
    }

    fetchAddresses()
  }, [keys])

  if (keys.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">Inga nycklar</div>
    )
  }

  return (
    <CollapsibleGroupTable
      items={sortedKeys}
      getItemId={(key) => key.id}
      columnCount={5}
      className={className}
      initialExpanded={initialExpanded}
      groupBy={(key) => key.rentalObjectCode || '__no_object__'}
      renderHeader={() => (
        <TableRow className="bg-background border-b">
          <TableHead className={`w-[30%]${indent ? ' pl-14' : ''}`}>Nyckelnamn</TableHead>
          <TableHead className="w-[15%]">Typ</TableHead>
          <TableHead className="w-[15%]">Löpnummer</TableHead>
          <TableHead className="w-[15%]">Flexnummer</TableHead>
          <TableHead className="w-[15%]">Status</TableHead>
        </TableRow>
      )}
      renderRow={(key) => (
        <TableRow key={key.id} className="bg-background h-12 hover:bg-muted/50">
          <TableCell className={`w-[30%]${indent ? ' pl-14' : ''}`}>
            <TableLink
              to={`/Keys?q=${encodeURIComponent(key.keyName)}${key.rentalObjectCode ? `&rentalObjectCode=${key.rentalObjectCode}` : ''}&disposed=false`}
            >
              {key.keyName}
            </TableLink>
          </TableCell>
          <TableCell className="w-[15%]">
            <KeyTypeBadge keyType={key.keyType} />
          </TableCell>
          <TableCell className="w-[15%] text-muted-foreground">
            {key.keySequenceNumber || '-'}
          </TableCell>
          <TableCell className="w-[15%] text-muted-foreground">
            {key.flexNumber || '-'}
          </TableCell>
          <TableCell className="w-[15%]">
            <DisposedBadge disposed={key.disposed ?? false} showActive />
          </TableCell>
        </TableRow>
      )}
      renderGroupHeader={(rentalObjectCode, groupKeys) => {
        if (rentalObjectCode === '__no_object__') {
          return (
            <div className="flex items-center gap-3">
              <span className="font-semibold text-muted-foreground">
                Ingen objektkod
              </span>
              <Badge variant="secondary" className="text-xs">
                {groupKeys.length}{' '}
                {groupKeys.length === 1 ? 'nyckel' : 'nycklar'}
              </Badge>
            </div>
          )
        }
        return (
          <div className="flex items-center gap-3">
            <span className="font-semibold">{rentalObjectCode}</span>
            <span className="text-muted-foreground">
              {isLoadingAddresses
                ? 'Laddar adress...'
                : addressMap[rentalObjectCode] || 'Okänd adress'}
            </span>
            <Badge variant="secondary" className="text-xs">
              {groupKeys.length} {groupKeys.length === 1 ? 'nyckel' : 'nycklar'}
            </Badge>
          </div>
        )
      }}
    />
  )
}
