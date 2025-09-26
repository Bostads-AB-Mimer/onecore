import { useState, useMemo } from "react";
import { KeySystemsHeader } from "@/components/key-systems/KeySystemsHeader";
import { KeySystemsToolbar } from "@/components/key-systems/KeySystemsToolbar";
import { KeySystemsTable } from "@/components/key-systems/KeySystemsTable";
import { AddKeySystemForm } from "@/components/key-systems/AddKeySystemForm";

import { KeySystem, Key } from "@/services/types";
import { useToast } from "@/hooks/use-toast";

// Sample data for key systems
const initialKeySystems: KeySystem[] = [
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

// Sample keys data to show in key system exploration
const sampleKeys: Key[] = [
  {
    id: '1',
    keyName: 'CFG',
    keySequenceNumber: 1,
    flexNumber: 1,
    rentalObject: '811-039-05-0347',
    keyType: 'LGH',
    keySystemName: 'ABC123',
    createdAt: '2025-09-16T00:00:00Z',
    updatedAt: '2025-09-16T00:00:00Z',
  },
  {
    id: '2',
    keyName: 'CFG',
    keySequenceNumber: 2,
    flexNumber: 1,
    rentalObject: '811-039-05-0347',
    keyType: 'LGH',
    keySystemName: 'ABC123',
    createdAt: '2025-09-22T00:00:00Z',
    updatedAt: '2025-09-22T00:00:00Z',
  },
  {
    id: '3',
    keyName: 'BGH',
    keySequenceNumber: 1,
    flexNumber: 1,
    rentalObject: '819-005-09-0703',
    keyType: 'PB',
    keySystemName: 'DEF456',
    createdAt: '2025-08-09T00:00:00Z',
    updatedAt: '2025-08-09T00:00:00Z',
  },
  {
    id: '4',
    keyName: 'HYB',
    keySequenceNumber: 3,
    flexNumber: 2,
    rentalObject: '820-011-02-0156',
    keyType: 'FS',
    keySystemName: 'GHI789',
    createdAt: '2025-07-15T00:00:00Z',
    updatedAt: '2025-07-15T00:00:00Z',
  },
];

export default function KeySystems() {
  const [KeySystems, setKeySystems] = useState<KeySystem[]>(initialKeySystems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKeySystem, setEditingKeySystem] = useState<KeySystem | null>(null);
  const { toast } = useToast();

  const filteredKeySystems = useMemo(() => {
    return KeySystems.filter((KeySystem) => {
      const matchesSearch = 
        KeySystem.system_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        KeySystem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (KeySystem.manufacturer && KeySystem.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesType = selectedType === "all" || KeySystem.type === selectedType;
      
      const matchesStatus = selectedStatus === "all" || 
        (selectedStatus === "active" && KeySystem.is_active) ||
        (selectedStatus === "inactive" && !KeySystem.is_active);
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [KeySystems, searchQuery, selectedType, selectedStatus]);

  const handleAddNew = () => {
    setEditingKeySystem(null);
    setShowAddForm(true);
  };

  const handleEdit = (KeySystem: KeySystem) => {
    setEditingKeySystem(KeySystem);
    setShowAddForm(true);
  };


  const handleSave = (KeySystemData: Omit<KeySystem, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingKeySystem) {
      // Update existing key system
      setKeySystems(prev => prev.map(ls =>
        ls.id === editingKeySystem.id
          ? {
              ...ls,
              ...KeySystemData,
              updated_at: new Date().toISOString()
            }
          : ls
      ));
      toast({
        title: "Låssystem uppdaterat",
        description: `${KeySystemData.name} har uppdaterats framgångsrikt.`,
      });
    } else {
      // Add new key system
      const newKeySystem: KeySystem = {
        ...KeySystemData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setKeySystems(prev => [...prev, newKeySystem]);
      toast({
        title: "Låssystem skapat",
        description: `${KeySystemData.name} har skapats framgångsrikt.`,
      });
    }
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingKeySystem(null);
  };

  const handleDelete = (id: string) => {
    const KeySystem = KeySystems.find(ls => ls.id === id);
    if (KeySystem) {
      setKeySystems(prev => prev.filter(ls => ls.id !== id));
      toast({
        title: "Låssystem borttaget",
        description: `${KeySystem.name} har tagits bort.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <KeySystemsHeader 
        totalKeySystems={KeySystems.length}
        displayedKeySystems={filteredKeySystems.length}
      />
      
      <KeySystemsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        onAddNew={handleAddNew}
      />

      <KeySystemsTable
        KeySystems={filteredKeySystems}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExplore={() => {}} // No longer used, navigation handled in table
      />

      {showAddForm && (
        <AddKeySystemForm
          onSave={handleSave}
          onCancel={handleCancel}
          editingKeySystem={editingKeySystem}
        />
      )}

    </div>
  );
}