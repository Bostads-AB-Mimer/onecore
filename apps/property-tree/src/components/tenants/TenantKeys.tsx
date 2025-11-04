import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface KeyData {
  id: string;
  keyType: string;
  keyName: string;
  flexNumber: string;
  rentalObject: string;
  keySystem: string;
  serialNumber: string;
  loanedDate: string;
}

const mockKeys: KeyData[] = [
  {
    id: "1",
    keyType: "Bostad",
    keyName: "Huvudnyckel",
    flexNumber: "FL-2024-001",
    rentalObject: "Björnen 4, Lägenhet 1201",
    keySystem: "Alliera",
    serialNumber: "ALR-89234",
    loanedDate: "2024-01-15",
  },
  {
    id: "2",
    keyType: "Drop/tagg",
    keyName: "Porttelefon",
    flexNumber: "FL-2024-002",
    rentalObject: "Björnen 4, Entré A",
    keySystem: "Alliera",
    serialNumber: "ALR-89235",
    loanedDate: "2024-01-15",
  },
  {
    id: "3",
    keyType: "Postbox",
    keyName: "Brevlådenyckel",
    flexNumber: "FL-2024-003",
    rentalObject: "Björnen 4, Box 1201",
    keySystem: "Alliera",
    serialNumber: "ALR-89236",
    loanedDate: "2024-01-15",
  },
  {
    id: "4",
    keyType: "Garage",
    keyName: "Garagenyckel",
    flexNumber: "FL-2024-004",
    rentalObject: "Björnen 4, Garage 45",
    keySystem: "Alliera",
    serialNumber: "ALR-89237",
    loanedDate: "2024-02-01",
  },
  {
    id: "5",
    keyType: "Förråd",
    keyName: "Förråd källare",
    flexNumber: "FL-2024-005",
    rentalObject: "Björnen 4, Förråd 12",
    keySystem: "Alliera",
    serialNumber: "ALR-89238",
    loanedDate: "2024-01-15",
  },
];

export const TenantKeys = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nyckelknippa</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nyckeltyp</TableHead>
                <TableHead>Nyckelnamn</TableHead>
                <TableHead>Flexnummer</TableHead>
                <TableHead>Tillhör hyresobjekt</TableHead>
                <TableHead>Nyckelsystem</TableHead>
                <TableHead>Löpnummer</TableHead>
                <TableHead>Utlåningsdatum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>
                    {key.keyType}
                  </TableCell>
                  <TableCell className="font-medium">{key.keyName}</TableCell>
                  <TableCell>{key.flexNumber}</TableCell>
                  <TableCell>{key.rentalObject}</TableCell>
                  <TableCell>{key.keySystem}</TableCell>
                  <TableCell>{key.serialNumber}</TableCell>
                  <TableCell>{key.loanedDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
