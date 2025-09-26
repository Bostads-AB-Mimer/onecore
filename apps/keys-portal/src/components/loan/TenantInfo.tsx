import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Calendar, MapPin, ArrowLeft } from "lucide-react";
import type { Tenant, Contract } from "@/types/tenant";

interface TenantInfoProps {
  tenant: Tenant;
  contracts: Contract[];
  onBack: () => void;
  onSelectContract: (contract: Contract) => void;
}

export function TenantInfo({ tenant, contracts, onBack, onSelectContract }: TenantInfoProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {tenant.first_name} {tenant.last_name}
          </CardTitle>
          <CardDescription>
            Personnummer: {tenant.personnummer}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenant.email && (
            <p className="text-sm text-muted-foreground">
              E-post: {tenant.email}
            </p>
          )}
          {tenant.phone && (
            <p className="text-sm text-muted-foreground">
              Telefon: {tenant.phone}
            </p>
          )}
          {tenant.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {tenant.address}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktiva kontrakt</CardTitle>
          <CardDescription>
            Välj ett kontrakt för att se tillhörande nycklar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {contracts.length === 0 ? (
            <p className="text-muted-foreground">Inga aktiva kontrakt hittades</p>
          ) : (
            contracts.map((contract) => (
              <Card key={contract.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent 
                  className="p-4"
                  onClick={() => onSelectContract(contract)}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-medium">{contract.rental_object}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Från: {new Date(contract.start_date).toLocaleDateString('sv-SE')}
                        </span>
                        {contract.end_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Till: {new Date(contract.end_date).toLocaleDateString('sv-SE')}
                          </span>
                        )}
                      </div>
                      {contract.monthly_rent && (
                        <p className="text-sm text-muted-foreground">
                          Hyra: {contract.monthly_rent.toLocaleString('sv-SE')} kr/mån
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={contract.is_active ? "default" : "secondary"}>
                        {contract.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                      <Button size="sm" variant="outline">
                        Visa nycklar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}