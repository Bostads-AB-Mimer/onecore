import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, Lease } from "@/../../libs/types/src/types";

interface SearchTenantProps {
  onTenantFound: (tenant: Tenant, contracts: Lease[]) => void;
}

export function SearchTenant({ onTenantFound }: SearchTenantProps) {
  const [personnummer, setPersonnummer] = useState("");
  const { toast } = useToast();

  const handleSearch = () => {
    if (!personnummer.trim()) {
      toast({
        title: "Personnummer krävs",
        description: "Ange ett giltigt personnummer för att söka",
        variant: "destructive",
      });
      return;
    }

    // Frontend shell only — no search yet.
    toast({
      title: "Sökning kommer snart",
      description: "Vi kopplar på vår söktjänst och återkommer hit.",
    });

    // When backend is ready:
    // const tenant = ...;
    // const leases: Lease[] = ...;
    // onTenantFound(tenant, leases);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Sök hyresgäst
        </CardTitle>
        <CardDescription>
          Ange personnummer för att hitta hyresgäst och visa kontrakt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="YYYYMMDD-XXXX"
            value={personnummer}
            onChange={(e) => setPersonnummer(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleSearch} className="gap-2">
            <Search className="h-4 w-4" />
            Sök
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Format: YYYYMMDD-XXXX (t.ex. 19850315-1234)
        </p>
      </CardContent>
    </Card>
  );
}
