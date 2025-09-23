import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Key, KeyType, KeyTypeLabels } from "@/types/key";

interface AddKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (key: Omit<Key, 'id' | 'created_at' | 'updated_at'>) => void;
  editingKey?: Key | null;
}

export function AddKeyDialog({ open, onOpenChange, onSave, editingKey }: AddKeyDialogProps) {
  const [formData, setFormData] = useState({
    key_name: editingKey?.key_name || '',
    key_sequence_number: editingKey?.key_sequence_number || '',
    flex_number: editingKey?.flex_number || '',
    rental_object: editingKey?.rental_object || '',
    key_type: editingKey?.key_type || 'LGH' as KeyType,
    key_system_name: editingKey?.key_system_name || '',
  });

  const handleSave = () => {
    if (!formData.key_name || !formData.key_type) return;

    onSave({
      key_name: formData.key_name,
      key_sequence_number: formData.key_sequence_number ? Number(formData.key_sequence_number) : undefined,
      flex_number: formData.flex_number ? Number(formData.flex_number) : undefined,
      rental_object: formData.rental_object || undefined,
      key_type: formData.key_type,
      key_system_name: formData.key_system_name || undefined,
      key_system_id: undefined,
    });
    
    setFormData({
      key_name: '',
      key_sequence_number: '',
      flex_number: '',
      rental_object: '',
      key_type: 'LGH',
      key_system_name: '',
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({
      key_name: '',
      key_sequence_number: '',
      flex_number: '',
      rental_object: '',
      key_type: 'LGH',
      key_system_name: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingKey ? 'Redigera nyckel' : 'Lägg till ny nyckel'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="key_name">Nyckelnamn *</Label>
            <Input
              id="key_name"
              value={formData.key_name}
              onChange={(e) => setFormData(prev => ({ ...prev, key_name: e.target.value }))}
              placeholder="t.ex. CFG, BGH, BCD"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="rental_object">Objekt</Label>
            <Input
              id="rental_object"
              value={formData.rental_object}
              onChange={(e) => setFormData(prev => ({ ...prev, rental_object: e.target.value }))}
              placeholder="t.ex. 811-039-05-0347"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="key_type">Typ *</Label>
            <Select 
              value={formData.key_type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, key_type: value as KeyType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KeyTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="key_system_name">Låssystem</Label>
            <Input
              id="key_system_name"
              value={formData.key_system_name}
              onChange={(e) => setFormData(prev => ({ ...prev, key_system_name: e.target.value }))}
              placeholder="t.ex. ABC123"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="key_sequence_number">Löpnummer</Label>
              <Input
                id="key_sequence_number"
                type="number"
                value={formData.key_sequence_number}
                onChange={(e) => setFormData(prev => ({ ...prev, key_sequence_number: e.target.value }))}
                placeholder="1, 2, 3..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="flex_number">Flexnr</Label>
              <Input
                id="flex_number"
                type="number"
                value={formData.flex_number}
                onChange={(e) => setFormData(prev => ({ ...prev, flex_number: e.target.value }))}
                placeholder="1"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!formData.key_name || !formData.key_type}
          >
            {editingKey ? 'Uppdatera' : 'Lägg till'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}