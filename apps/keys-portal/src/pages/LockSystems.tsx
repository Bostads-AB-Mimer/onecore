import { useState, useMemo } from "react";
import { LockSystemsHeader } from "@/components/lock-systems/LockSystemsHeader";
import { LockSystemsToolbar } from "@/components/lock-systems/LockSystemsToolbar";
import { LockSystemsTable } from "@/components/lock-systems/LockSystemsTable";
import { AddLockSystemDialog } from "@/components/lock-systems/AddLockSystemDialog";

import { LockSystem } from "@/types/lock-system";
import { Key } from "@/types/key";
import { useToast } from "@/hooks/use-toast";

// Sample data for lock systems
const initialLockSystems: LockSystem[] = [
  {
    id: "1",
    system_code: "ABC123",
    name: "Huvudentré System",
    manufacturer: "ASSA ABLOY",
    managing_supplier: "Låsteknik AB",
    type: "ELECTRONIC",
    property_ids: ["prop1", "prop2"],
    installation_date: "2023-01-15T00:00:00Z",
    is_active: true,
    description: "Elektroniskt låssystem för huvudentréer",
    created_at: "2023-01-15T10:00:00Z",
    updated_at: "2023-01-15T10:00:00Z",
    created_by: "admin",
    updated_by: "admin",
  },
  {
    id: "2",
    system_code: "DEF456",
    name: "Källarsystem",
    manufacturer: "Securitas",
    managing_supplier: "Säkerhet Nord AB",
    type: "MECHANICAL",
    installation_date: "2022-06-20T00:00:00Z",
    is_active: true,
    description: "Mekaniskt system för källarutrymmen",
    created_at: "2022-06-20T10:00:00Z",
    updated_at: "2022-06-20T10:00:00Z",
    created_by: "admin",
    updated_by: "admin",
  },
  {
    id: "3",
    system_code: "GHI789",
    name: "Kombinerat System",
    manufacturer: "ASSA ABLOY",
    managing_supplier: "Låsteknik AB",
    type: "HYBRID",
    installation_date: "2023-08-10T00:00:00Z",
    is_active: false,
    description: "Hybrid system med både elektroniska och mekaniska komponenter",
    created_at: "2023-08-10T10:00:00Z",
    updated_at: "2023-09-01T10:00:00Z",
    created_by: "admin",
    updated_by: "admin",
  },
];

// Sample keys data to show in lock system exploration
const sampleKeys: Key[] = [
  {
    id: '1',
    key_name: 'CFG',
    key_sequence_number: 1,
    flex_number: 1,
    rental_object: '811-039-05-0347',
    key_type: 'LGH',
    key_system_name: 'ABC123',
    created_at: '2025-09-16T00:00:00Z',
    updated_at: '2025-09-16T00:00:00Z',
  },
  {
    id: '2',
    key_name: 'CFG',
    key_sequence_number: 2,
    flex_number: 1,
    rental_object: '811-039-05-0347',
    key_type: 'LGH',
    key_system_name: 'ABC123',
    created_at: '2025-09-22T00:00:00Z',
    updated_at: '2025-09-22T00:00:00Z',
  },
  {
    id: '3',
    key_name: 'BGH',
    key_sequence_number: 1,
    flex_number: 1,
    rental_object: '819-005-09-0703',
    key_type: 'PB',
    key_system_name: 'DEF456',
    created_at: '2025-08-09T00:00:00Z',
    updated_at: '2025-08-09T00:00:00Z',
  },
  {
    id: '4',
    key_name: 'HYB',
    key_sequence_number: 3,
    flex_number: 2,
    rental_object: '820-011-02-0156',
    key_type: 'FS',
    key_system_name: 'GHI789',
    created_at: '2025-07-15T00:00:00Z',
    updated_at: '2025-07-15T00:00:00Z',
  },
];

export default function LockSystems() {
  const [lockSystems, setLockSystems] = useState<LockSystem[]>(initialLockSystems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLockSystem, setEditingLockSystem] = useState<LockSystem | null>(null);
  const { toast } = useToast();

  const filteredLockSystems = useMemo(() => {
    return lockSystems.filter((lockSystem) => {
      const matchesSearch = 
        lockSystem.system_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lockSystem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lockSystem.manufacturer && lockSystem.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesType = selectedType === "all" || lockSystem.type === selectedType;
      
      const matchesStatus = selectedStatus === "all" || 
        (selectedStatus === "active" && lockSystem.is_active) ||
        (selectedStatus === "inactive" && !lockSystem.is_active);
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [lockSystems, searchQuery, selectedType, selectedStatus]);

  const handleAddNew = () => {
    setEditingLockSystem(null);
    setDialogOpen(true);
  };

  const handleEdit = (lockSystem: LockSystem) => {
    setEditingLockSystem(lockSystem);
    setDialogOpen(true);
  };


  const handleSave = (lockSystemData: Omit<LockSystem, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingLockSystem) {
      // Update existing lock system
      setLockSystems(prev => prev.map(ls => 
        ls.id === editingLockSystem.id 
          ? { 
              ...ls, 
              ...lockSystemData, 
              updated_at: new Date().toISOString() 
            }
          : ls
      ));
      toast({
        title: "Låssystem uppdaterat",
        description: `${lockSystemData.name} har uppdaterats framgångsrikt.`,
      });
    } else {
      // Add new lock system
      const newLockSystem: LockSystem = {
        ...lockSystemData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLockSystems(prev => [...prev, newLockSystem]);
      toast({
        title: "Låssystem skapat",
        description: `${lockSystemData.name} har skapats framgångsrikt.`,
      });
    }
  };

  const handleDelete = (id: string) => {
    const lockSystem = lockSystems.find(ls => ls.id === id);
    if (lockSystem) {
      setLockSystems(prev => prev.filter(ls => ls.id !== id));
      toast({
        title: "Låssystem borttaget",
        description: `${lockSystem.name} har tagits bort.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <LockSystemsHeader 
        totalLockSystems={lockSystems.length}
        displayedLockSystems={filteredLockSystems.length}
      />
      
      <LockSystemsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        onAddNew={handleAddNew}
      />

      <LockSystemsTable
        lockSystems={filteredLockSystems}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExplore={() => {}} // No longer used, navigation handled in table
      />

      <AddLockSystemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editingLockSystem={editingLockSystem}
      />

    </div>
  );
}