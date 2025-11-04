import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TenantDetailTabsProps {
  defaultValue: string;
  children: React.ReactNode;
  hasActiveCases?: boolean;
}

export const TenantDetailTabs = ({ defaultValue, children, hasActiveCases }: TenantDetailTabsProps) => {
  return (
    <Tabs defaultValue={defaultValue} className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        <TabsTrigger value="contracts">
          Hyreskontrakt
        </TabsTrigger>
        <TabsTrigger value="queue">
          Kösystem
        </TabsTrigger>
        <TabsTrigger value="cases">
          {hasActiveCases ? "Ärenden (2)" : "Ärenden"}
        </TabsTrigger>
        <TabsTrigger value="ledger">
          Fakturor & betalningar
        </TabsTrigger>
        <TabsTrigger value="notes">
          Noteringar
        </TabsTrigger>
        <TabsTrigger value="keys">
          Nyckelknippa
        </TabsTrigger>
        <TabsTrigger value="events">
          Händelselogg
        </TabsTrigger>
        <TabsTrigger value="documents">
          Dokument
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
};