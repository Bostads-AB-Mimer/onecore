import { useState, useEffect } from "react";
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
import { rentalObjectSearchService, type RentalObjectSearchResult } from "@/services/api/rentalObjectSearchService";

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

  const [searchResults, setSearchResults] = useState<RentalObjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Only search if the rental ID looks complete (has minimum length and valid format)
      if (!rentalObjectSearchService.isValidRentalId(searchQuery)) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await rentalObjectSearchService.searchByRentalId(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [searchQuery]);

  const handleRentalObjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, rentalObject: value }));
    setSearchQuery(value);
  };

  const handleSelectSearchResult = (result: RentalObjectSearchResult) => {
    setFormData(prev => ({ ...prev, rentalObject: result.rentalId }));
    setSearchResults([]);
    setSearchQuery('');
  };

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
    setSearchResults([]);
    setSearchQuery('');
    setIsSearching(false);
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
          
          <div className="space-y-2 relative">
            <Label htmlFor="rentalObject">Objekt</Label>
            <div className="relative">
              <Input
                id="rentalObject"
                value={formData.rentalObject}
                onChange={handleRentalObjectChange}
                placeholder="t.ex. 811-039-05-0347"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.rentalId}-${index}`}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <div className="font-medium">{result.rentalId}</div>
                    <div className="text-sm text-gray-600">{result.address}</div>
                    <div className="text-xs text-gray-500 capitalize">{result.type}</div>
                  </button>
                ))}
              </div>
            )}
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