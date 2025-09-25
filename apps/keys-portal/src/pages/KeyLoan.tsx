import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { SearchTenant } from "@/components/loan/SearchTenant";
import { TenantInfo } from "@/components/loan/TenantInfo";
import type { Tenant, Lease } from "@/../../libs/types/src/types";

export default function KeyLoan() {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantContracts, setTenantContracts] = useState<Lease[]>([]);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const handleTenantFound = (tenant: Tenant, contracts: Lease[]) => {
    setSelectedTenant(tenant);
    setTenantContracts(contracts);

    // Scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleClearSearch = () => {
    setSelectedTenant(null);
    setTenantContracts([]);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Utlåning och återlämning</h1>
        <p className="text-muted-foreground">Lämna ut och ta emot nycklar</p>
      </header>

      {/* Search Section - Always Visible */}
      <div className="max-w-2xl mx-auto">
        <Tabs defaultValue="personnummer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personnummer">Personnummer</TabsTrigger>
            <TabsTrigger value="hyresobjekt" disabled>Hyresobjekt</TabsTrigger>
          </TabsList>

          <TabsContent value="personnummer" className="space-y-4">
            <SearchTenant onTenantFound={handleTenantFound} />
          </TabsContent>

          <TabsContent value="hyresobjekt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Sök på hyresobjekt
                </CardTitle>
                <CardDescription>Denna funktion kommer snart</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sökning på hyresobjekt är inte implementerad än.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Tenant Info - Shows Below Search When Available */}
      {selectedTenant && (
        <div ref={resultsRef} className="border-t pt-8">
          <TenantInfo
            tenant={selectedTenant}
            contracts={tenantContracts}
            onClearSearch={handleClearSearch}
          />
        </div>
      )}
    </div>
  );
}
