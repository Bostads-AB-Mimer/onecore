import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Key, KeyTypeLabels } from "@/types/key";

interface KeysTableProps {
  keys: Key[];
  onEdit: (key: Key) => void;
  onDelete: (keyId: string) => void;
}

export function KeysTable({ keys, onEdit, onDelete }: KeysTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE');
  };

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'LGH':
        return 'default';
      case 'PB':
        return 'secondary';
      case 'FS':
        return 'outline';
      case 'HN':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="font-medium">Nyckelnamn</TableHead>
            <TableHead className="font-medium">Objekt</TableHead>
            <TableHead className="font-medium">Typ</TableHead>
            <TableHead className="font-medium">Låssystem</TableHead>
            <TableHead className="font-medium">Löpnummer</TableHead>
            <TableHead className="font-medium">Flexnr</TableHead>
            <TableHead className="font-medium">Skapad</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Inga nycklar hittades
              </TableCell>
            </TableRow>
          ) : (
            keys.map((key) => (
              <TableRow key={key.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{key.keyName}</TableCell>
                <TableCell>{key.rentalObject || '-'}</TableCell>
                <TableCell>
                  <Badge variant={getTypeVariant(key.keyType)} className="text-xs">
                    {KeyTypeLabels[key.keyType]}
                  </Badge>
                </TableCell>
                <TableCell>{key.keySystemName || '-'}</TableCell>
                <TableCell>{key.keySequenceNumber || '-'}</TableCell>
                <TableCell>{key.flexNumber || '-'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(key.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(key)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Redigera
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(key.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Ta bort
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}