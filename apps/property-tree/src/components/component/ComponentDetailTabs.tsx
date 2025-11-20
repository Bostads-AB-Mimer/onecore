import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

export default function ComponentDetailTabs() {
  return (
    <Tabs defaultValue="placeholder" className="w-full">
      <TabsList>
        <TabsTrigger value="placeholder">Placeholder</TabsTrigger>
      </TabsList>
      <TabsContent value="placeholder">
        <div className="p-4 text-muted-foreground">
          Framtida flikar kommer att läggas till här
        </div>
      </TabsContent>
    </Tabs>
  )
}
