import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, User, Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, Contract } from "@/types/tenant";

interface SearchTenantProps {
  onTenantFound: (tenant: Tenant, contracts: Contract[]) => void;
}

export function SearchTenant({ onTenantFound }: SearchTenantProps) {
  const [personnummer, setPersonnummer] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!personnummer.trim()) {
      toast({
        title: "Personnummer krävs",
        description: "Ange ett giltigt personnummer för att söka",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      // Search for tenant by personnummer
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('personnummer', personnummer.trim())
        .single();

      if (tenantError || !tenant) {
        toast({
          title: "Hyresgäst inte hittad",
          description: "Ingen hyresgäst med detta personnummer hittades",
          variant: "destructive",
        });
        return;
      }

      // Get contracts for this tenant
      const { data: contracts, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (contractsError) {
        toast({
          title: "Fel vid hämtning av kontrakt",
          description: "Kunde inte hämta kontrakt för hyresgästen",
          variant: "destructive",
        });
        return;
      }

      onTenantFound(tenant, contracts || []);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Sökfel",
        description: "Ett fel uppstod vid sökning",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
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
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            {isSearching ? "Söker..." : "Sök"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Format: YYYYMMDD-XXXX (t.ex. 19850315-1234)
        </p>
      </CardContent>
    </Card>
  );
}