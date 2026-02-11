import {
  Table,
  TableBody,
  TableCell,
  TableCellMuted,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { KeyBundle } from '@/services/types'

interface KeyBundlesListProps {
  bundles: KeyBundle[]
}

function getKeyCount(keysString: string) {
  try {
    const keys = JSON.parse(keysString)
    return Array.isArray(keys) ? keys.length : 0
  } catch {
    return 0
  }
}

/** Simple table for displaying a list of key bundles */
export function KeyBundlesList({ bundles }: KeyBundlesListProps) {
  if (bundles.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Inga nyckelsamlingar
      </div>
    )
  }

  return (
    <Table>
      <TableHeader className="border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead>Namn</TableHead>
          <TableHead>Beskrivning</TableHead>
          <TableHead>Antal nycklar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bundles.map((bundle) => (
          <TableRow key={bundle.id} className="h-12 hover:bg-muted/50">
            <TableCell className="font-medium">{bundle.name}</TableCell>
            <TableCellMuted>{bundle.description || '-'}</TableCellMuted>
            <TableCell>
              <Badge variant="secondary">{getKeyCount(bundle.keys)}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
