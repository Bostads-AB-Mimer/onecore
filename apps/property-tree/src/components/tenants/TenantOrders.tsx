
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrdersManagement } from "@/components/residence/OrdersManagement";
import { mockTenant } from "@/data/tenants";

export function TenantOrders() {
  // Anna Andersson (mockTenant) is connected to residence lgh-1001
  const residenceId = "lgh-1001";
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Ärenden</CardTitle>
      </CardHeader>
      <CardContent>
        <OrdersManagement 
          contextType="tenant" 
          residenceId={residenceId}
          tenant={mockTenant}
        />
      </CardContent>
    </Card>
  );
}
