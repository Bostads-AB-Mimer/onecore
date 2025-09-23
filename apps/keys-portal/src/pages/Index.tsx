import { useState, useMemo, useEffect, useCallback } from "react";
import { KeysHeader } from "@/components/keys/KeysHeader";
import { KeysToolbar } from "@/components/keys/KeysToolbar";
import { KeysTable } from "@/components/keys/KeysTable";
import { AddKeyDialog } from "@/components/keys/AddKeyDialog";
import { useToast } from "@/hooks/use-toast";
import { Key } from "@/types/key";
import { keyService } from "@/services/api/keyService";
import type { components } from "@/services/api/generated/api-types";

type KeyDto = components["schemas"]["Key"];
type CreateKeyRequest = components["schemas"]["CreateKeyRequest"];
type UpdateKeyRequest = components["schemas"]["UpdateKeyRequest"];

const toUIKey = (k: KeyDto): Key => ({
  id: k.id ?? "",
  key_name: k.keyName ?? "",
  key_sequence_number: k.keySequenceNumber,
  flex_number: k.flexNumber,
  rental_object: k.rentalObjectCode,
  key_type: k.keyType as Key["key_type"],
  // API gives key_system_id; your UI type has key_system_name (optional).
  key_system_name: undefined,
  created_at: k.createdAt,
  updated_at: k.updatedAt,
});

const toCreateReq = (
  k: Omit<Key, "id" | "created_at" | "updated_at">
): CreateKeyRequest => ({
  keyName: k.key_name,
  keySequenceNumber: k.key_sequence_number,
  flexNumber: k.flex_number,
  rentalObjectCode: k.rental_object,
  keyType: k.key_type,
  // key_system_id: someUuidOrNull, // add when you wire key systems
});

const toUpdateReq = (
  before: Key,
  after: Omit<Key, "id" | "created_at" | "updated_at">
): UpdateKeyRequest => {
  const payload: UpdateKeyRequest = {};
  if (before.key_name !== after.key_name) payload.keyName = after.key_name;
  if (before.key_sequence_number !== after.key_sequence_number) payload.keySequenceNumber = after.key_sequence_number;
  if (before.flex_number !== after.flex_number) payload.flexNumber = after.flex_number;
  if (before.rental_object !== after.rental_object) payload.rentalObjectCode = after.rental_object;
  if (before.key_type !== after.key_type) payload.keyType = after.key_type;
  // if (before.key_system_id !== mappedId) payload.key_system_id = mappedId ?? null;
  return payload;
};

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

  const handleAddNew = () => {
    setEditingKey(null);
    setDialogOpen(true);
  };

  const handleEdit = (key: Key) => {
    setEditingKey(key);
    setDialogOpen(true);
  };

  const handleSave = async (keyData: Omit<Key, "id" | "created_at" | "updated_at">) => {
    if (editingKey) {
      try {
        const payload = toUpdateReq(editingKey, keyData);
        if (Object.keys(payload).length === 0) {
          setDialogOpen(false);
          return;
        }
        const updated = await keyService.updateKey(editingKey.id, payload);
        setKeys(prev => prev.map(k => (k.id === editingKey.id ? toUIKey(updated) : k)));
        toast({
          title: "Nyckel uppdaterad",
          description: `${updated.keyName ?? keyData.key_name} har uppdaterats.`,
        });
        setDialogOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Okänt fel vid uppdatering";
        toast({ title: "Kunde inte uppdatera nyckel", description: msg, variant: "destructive" });
      }
      return;
    }

    // Create
    try {
      const created = await keyService.createKey(toCreateReq(keyData));
      setKeys((prev) => [...prev, toUIKey(created)]);
      // or await fetchKeys() if you prefer server ordering immediately
      toast({ title: "Nyckel tillagd", description: `${keyData.key_name} har lagts till.` });
      setDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Okänt fel vid skapande";
      toast({ title: "Kunde inte skapa nyckel", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    if (!key) return;

    try {
      await keyService.deleteKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast({
        title: "Nyckel borttagen",
        description: `${key.key_name} har tagits bort.`,
        variant: "destructive",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Okänt fel vid borttagning";
      toast({
        title: "Kunde inte ta bort nyckel",
        description: msg,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <KeysHeader totalKeys={keys.length} displayedKeys={filteredKeys.length} />

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
