import { useState, useMemo, useEffect, useCallback } from "react";
import { KeysHeader } from "@/components/keys/KeysHeader";
import { KeysToolbar } from "@/components/keys/KeysToolbar";
import { KeysTable } from "@/components/keys/KeysTable";
import { AddKeyDialog } from "@/components/keys/AddKeyDialog";
import { useToast } from "@/hooks/use-toast";
import { Key } from "@/types/key";

import { keyService } from "@/services/api/keyService"; // <-- use your alias/path
import type { components } from "@/services/api/generated/api-types";

type KeyDto = components["schemas"]["Key"];

const toUIKey = (k: KeyDto): Key => ({
  id: k.id ?? "",
  key_name: k.key_name ?? "",
  key_sequence_number: k.key_sequence_number,
  flex_number: k.flex_number,
  rental_object: k.rental_object,
  key_type: k.key_type as Key["key_type"],
  // API gives key_system_id; your UI type has key_system_name (optional).
  // Leave it undefined for now, or later join with /key-systems to populate it.
  key_system_name: undefined,
  created_at: k.created_at,
  updated_at: k.updated_at,
});

const Index = () => {
  const [keys, setKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<Key | null>(null);
  const { toast } = useToast();

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await keyService.getAllKeys();
      setKeys(list.map(toUIKey));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Okänt fel";
      setError(msg);
      toast({
        title: "Kunde inte hämta nycklar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const filteredKeys = useMemo(() => {
    return keys.filter((key) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        key.key_name.toLowerCase().includes(q) ||
        key.rental_object?.toLowerCase().includes(q) ||
        key.key_system_name?.toLowerCase().includes(q);

      const matchesType = selectedType === "all" || key.key_type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [keys, searchQuery, selectedType]);

  // Keep edit/delete/add for UI demo if you like; they still only affect local state.
  const handleAddNew = () => {
    setEditingKey(null);
    setDialogOpen(true);
  };

  const handleEdit = (key: Key) => {
    setEditingKey(key);
    setDialogOpen(true);
  };

  const handleSave = (keyData: Omit<Key, "id" | "created_at" | "updated_at">) => {
    // Local-only changes for now; when you’re ready, wire to POST/PATCH.
    if (editingKey) {
      setKeys((prev) =>
        prev.map((key) =>
          key.id === editingKey.id
            ? { ...key, ...keyData, updated_at: new Date().toISOString() }
            : key
        )
      );
      toast({
        title: "Nyckel uppdaterad",
        description: `${keyData.key_name} har uppdaterats.`,
      });
    } else {
      const newKey: Key = {
        ...keyData,
        id: Math.random().toString(36).slice(2, 11),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setKeys((prev) => [...prev, newKey]);
      toast({
        title: "Nyckel tillagd",
        description: `${keyData.key_name} har lagts till.`,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    if (key) {
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast({
        title: "Nyckel borttagen",
        description: `${key.key_name} har tagits bort (lokalt).`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <KeysHeader totalKeys={keys.length} displayedKeys={filteredKeys.length} />

        {/* If you want a manual refresh, you could add a refresh button in KeysToolbar later */}
        <KeysToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          onAddNew={handleAddNew}
        />

        {loading && (
          <div className="text-sm text-muted-foreground py-4">Hämtar nycklar…</div>
        )}
        {error && (
          <div className="text-sm text-red-600 py-2">Fel: {error}</div>
        )}

        <KeysTable keys={filteredKeys} onEdit={handleEdit} onDelete={handleDelete} />

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
