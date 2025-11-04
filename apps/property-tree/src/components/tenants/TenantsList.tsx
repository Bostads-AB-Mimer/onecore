
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAllCustomers } from "@/data/tenants";

// Get all customers (tenants and applicants) and create display data
const customers = getAllCustomers().map(customer => ({
  ...customer,
  id: customer.personalNumber,
  property: customer.customerType === "tenant" ? getPropertyForTenant(customer.personalNumber) : "Ingen bostad"
}));

function getPropertyForTenant(personalNumber: string) {
  switch(personalNumber) {
    case "19850101-1234": return "Älgen 1";
    case "19760315-5678": return "Björnen 4";
    case "19911122-9012": return "Lindaren 2";
    case "19820812-3456": return "Ekoxen 3";
    case "19900228-7890": return "Granen 5";
    case "19750515-2345": return "Vildsvinet 7";
    default: return "Okänd fastighet";
  }
}

export function TenantsList() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredCustomers = customers.filter(customer => {
    return (
      customer.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.property.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kundlista</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Input
              placeholder="Sök på namn, ID eller fastighet..."
              className="pl-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>Personnummer</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Fastighet</TableHead>
                <TableHead className="text-right">Åtgärd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.firstName} {customer.lastName}
                  </TableCell>
                  <TableCell>{customer.id}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={customer.customerType === "tenant" ? "default" : "secondary"}
                    >
                      {customer.customerType === "tenant" ? "Hyresgäst" : "Sökande"}
                    </Badge>
                  </TableCell>
                  <TableCell>{customer.property}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="link" size="sm">
                      <Link to={`/tenants/detail/${customer.id}`}>
                        Visa detaljer
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Inga kunder hittades med angivna sökkriterier
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
