import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { KeySystem, KeySystemTypeLabels, Property } from '@/services/types'
import { sampleProperties } from '@/mockdata/sampleProperties'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

interface KeySystemsTableProps {
  KeySystems: KeySystem[]
  onEdit: (KeySystem: KeySystem) => void
  onDelete: (id: string) => void
  onExplore: (KeySystem: KeySystem) => void
}

export function KeySystemsTable({
  KeySystems,
  onEdit,
  onDelete,
  onExplore,
}: KeySystemsTableProps) {
  const navigate = useNavigate()
  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'MECHANICAL':
        return 'secondary'
      case 'ELECTRONIC':
        return 'default'
      case 'HYBRID':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PP', { locale: sv })
    } catch {
      return dateString
    }
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Systemkod</TableHead>
            <TableHead>Namn</TableHead>
            <TableHead>Tillverkare</TableHead>
            <TableHead>Fastigheter</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Installationsdatum</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {KeySystems.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-muted-foreground py-8"
              >
                Inga låssystem hittades
              </TableCell>
            </TableRow>
          ) : (
            KeySystems.map((KeySystem) => {
              // Parse propertyIds if it's a JSON string
              let propertyIdArray: string[] = []
              if (KeySystem.propertyIds) {
                try {
                  propertyIdArray =
                    typeof KeySystem.propertyIds === 'string'
                      ? JSON.parse(KeySystem.propertyIds)
                      : KeySystem.propertyIds
                } catch (e) {
                  console.error('Failed to parse propertyIds:', e)
                }
              }

              const properties = sampleProperties.filter((prop) =>
                propertyIdArray?.includes(prop.id)
              )

              return (
                <TableRow key={KeySystem.id}>
                  <TableCell className="font-medium">
                    {KeySystem.systemCode}
                  </TableCell>
                  <TableCell>{KeySystem.name}</TableCell>
                  <TableCell>{KeySystem.manufacturer || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {properties.length > 0 ? (
                        properties.map((property) => (
                          <Badge
                            key={property.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {property.designation}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeVariant(KeySystem.type)}>
                      {KeySystemTypeLabels[KeySystem.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={KeySystem.isActive ? 'default' : 'secondary'}
                    >
                      {KeySystem.isActive ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {KeySystem.installationDate
                      ? formatDate(KeySystem.installationDate.toString())
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(`/key-systems/${KeySystem.id}`)
                          }
                        >
                          <Search className="mr-2 h-4 w-4" />
                          Utforska
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(KeySystem)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Redigera
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(KeySystem.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Ta bort
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
