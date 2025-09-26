import { useState, useMemo } from "react";
import { KeysHeader } from "@/components/keys/KeysHeader";
import { KeysToolbar } from "@/components/keys/KeysToolbar";
import { KeysTable } from "@/components/keys/KeysTable";
import { AddKeyDialog } from "@/components/keys/AddKeyDialog";
import { useToast } from "@/hooks/use-toast";
import { Key } from "@/types/key";

// Sample data for demo purposes
const initialKeys: Key[] = [
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
];

const Index = () => {
  const [keys, setKeys] = useState<Key[]>(initialKeys);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<Key | null>(null);
  const { toast } = useToast();

  const filteredKeys = useMemo(() => {
    return keys.filter(key => {
      const matchesSearch = key.key_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          key.rental_object?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          key.key_system_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = selectedType === 'all' || key.key_type === selectedType;
      
      return matchesSearch && matchesType;
    });
  }, [keys, searchQuery, selectedType]);

  const handleAddNew = () => {
    setEditingKey(null);
    setDialogOpen(true);
  };

  const handleEdit = (key: Key) => {
    setEditingKey(key);
    setDialogOpen(true);
  };

  const handleSave = (keyData: Omit<Key, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingKey) {
      // Update existing key
      setKeys(prev => prev.map(key => 
        key.id === editingKey.id 
          ? { ...key, ...keyData, updated_at: new Date().toISOString() }
          : key
      ));
      toast({
        title: "Nyckel uppdaterad",
        description: `${keyData.key_name} har uppdaterats framgångsrikt.`,
      });
    } else {
      // Add new key
      const newKey: Key = {
        ...keyData,
        id: Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setKeys(prev => [...prev, newKey]);
      toast({
        title: "Nyckel tillagd",
        description: `${keyData.key_name} har lagts till framgångsrikt.`,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = (keyId: string) => {
    const key = keys.find(k => k.id === keyId);
    if (key) {
      setKeys(prev => prev.filter(k => k.id !== keyId));
      toast({
        title: "Nyckel borttagen",
        description: `${key.key_name} har tagits bort.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <KeysHeader 
          totalKeys={keys.length}
          displayedKeys={filteredKeys.length}
        />
        
        <KeysToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          onAddNew={handleAddNew}
        />
        
        <KeysTable
          keys={filteredKeys}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        
        <AddKeyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSave}
          editingKey={editingKey}
        />
      </div>
    </div>
  );
};

export default Index;
