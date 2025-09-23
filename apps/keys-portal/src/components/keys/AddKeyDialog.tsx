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
  onSave: (key: Omit<Key, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingKey?: Key | null;
}


export function AddKeyDialog({ open, onOpenChange, onSave, editingKey }: AddKeyDialogProps) {
  const [formData, setFormData] = useState({
    keyName: editingKey?.keyName || '',
    keySequenceNumber: editingKey?.keySequenceNumber || '',
    flexNumber: editingKey?.flexNumber || '',
    rentalObject: editingKey?.rentalObject || '',
    keyType: editingKey?.keyType || 'LGH' as KeyType,
    keySystemName: editingKey?.keySystemName || '',
  });

  const handleSave = () => {
    if (!formData.keyName || !formData.keyType) return;

    onSave({
      keyName: formData.keyName,
      keySequenceNumber: formData.keySequenceNumber ? Number(formData.keySequenceNumber) : undefined,
      flexNumber: formData.flexNumber ? Number(formData.flexNumber) : undefined,
      rentalObject: formData.rentalObject || undefined,
      keyType: formData.keyType,
      keySystemName: formData.keySystemName || undefined,
      keySystemId: undefined,
    });
    
    setFormData({
      keyName: '',
      keySequenceNumber: '',
      flexNumber: '',
      rentalObject: '',
      keyType: 'LGH',
      keySystemName: '',
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({
      keyName: '',
      keySequenceNumber: '',
      flexNumber: '',
      rentalObject: '',
      keyType: 'LGH',
      keySystemName: '',
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
            <Label htmlFor="keyName">Nyckelnamn *</Label>
            <Input
              id="keyName"
              value={formData.keyName}
              onChange={(e) => setFormData(prev => ({ ...prev, keyName: e.target.value }))}
              placeholder="t.ex. CFG, BGH, BCD"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="rentalObject">Objekt</Label>
            <Input
              id="rentalObject"
              value={formData.rentalObject}
              onChange={(e) => setFormData(prev => ({ ...prev, rentalObject: e.target.value }))}
              placeholder="t.ex. 811-039-05-0347"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="keyType">Typ *</Label>
            <Select 
              value={formData.keyType} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, keyType: value as KeyType }))}
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
            <Label htmlFor="keySystemName">Låssystem</Label>
            <Input
              id="keySystemName"
              value={formData.keySystemName}
              onChange={(e) => setFormData(prev => ({ ...prev, keySystemName: e.target.value }))}
              placeholder="t.ex. ABC123"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keySequenceNumber">Löpnummer</Label>
              <Input
                id="keySequenceNumber"
                type="number"
                value={formData.keySequenceNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, keySequenceNumber: e.target.value }))}
                placeholder="1, 2, 3..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="flexNumber">Flexnr</Label>
              <Input
                id="flexNumber"
                type="number"
                value={formData.flexNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, flexNumber: e.target.value }))}
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
            disabled={!formData.keyName || !formData.keyType}
          >
            {editingKey ? 'Uppdatera' : 'Lägg till'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}