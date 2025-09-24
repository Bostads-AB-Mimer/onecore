import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Trash2, Star, Plus, Clock } from "lucide-react";
import { SavedSearch } from "@/types/search";
import { toast } from "@/components/hooks/useToast";

interface SearchFavoritesProps {
  favorites: SavedSearch[];
  onUseFavorite: (favorite: SavedSearch) => void;
  onDeleteFavorite: (id: string) => void;
  onSaveCurrentSearch: (name: string) => SavedSearch | null;
  currentQuery: string;
  hasActiveFilters: boolean;
}

export function SearchFavorites({
  favorites,
  onUseFavorite,
  onDeleteFavorite,
  onSaveCurrentSearch,
  currentQuery,
  hasActiveFilters
}: SearchFavoritesProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState("");

  const handleSaveFavorite = () => {
    if (!newFavoriteName.trim()) {
      toast({
        title: "Ange ett namn",
        description: "Du måste ange ett namn för den sparade sökningen.",
        variant: "destructive"
      });
      return;
    }

    const savedSearch = onSaveCurrentSearch(newFavoriteName.trim());
    if (savedSearch) {
      toast({
        title: "Sökning sparad",
        description: `"${newFavoriteName}" har lagts till i dina favoriter.`
      });
      setNewFavoriteName("");
      setIsCreating(false);
    } else {
      toast({
        title: "Kunde inte spara sökning",
        description: "Det finns ingen aktiv sökning att spara.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteFavorite = (id: string, name: string) => {
    onDeleteFavorite(id);
    toast({
      title: "Favorit borttagen",
      description: `"${name}" har tagits bort från dina favoriter.`
    });
  };

  const formatLastUsed = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Idag";
    if (diffDays === 1) return "Igår";
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} veckor sedan`;
    return `${Math.floor(diffDays / 30)} månader sedan`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Star className="h-4 w-4" />
          Sparade sökningar
        </h4>
        
        {currentQuery && !isCreating && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="h-6 px-2 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Spara denna sökning
          </Button>
        )}
      </div>

      {/* Create new favorite */}
      {isCreating && (
        <div className="p-3 bg-accent/30 rounded-lg border space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Namn på sparad sökning
            </label>
            <Input
              value={newFavoriteName}
              onChange={(e) => setNewFavoriteName(e.target.value)}
              placeholder="t.ex. 'Pågående ärenden område A'"
              className="h-8 mt-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveFavorite();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewFavoriteName("");
                }
              }}
            />
          </div>
          
          <div className="text-xs text-muted-foreground">
            Sparar: "<strong>{currentQuery}</strong>"
            {hasActiveFilters && " med aktiva filter"}
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSaveFavorite}
              className="h-6 px-3 text-xs"
            >
              Spara
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setNewFavoriteName("");
              }}
              className="h-6 px-3 text-xs"
            >
              Avbryt
            </Button>
          </div>
        </div>
      )}

      {/* Favorites list */}
      {favorites.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="group p-3 rounded-lg border hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <button
                  onClick={() => onUseFavorite(favorite)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="font-medium text-sm truncate">
                    {favorite.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {favorite.query}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatLastUsed(favorite.lastUsed)}
                    </div>
                    <Badge variant="outline" className="h-4 text-xs">
                      {favorite.useCount} gånger
                    </Badge>
                    {favorite.filters.length > 0 && (
                      <Badge variant="secondary" className="h-4 text-xs">
                        {favorite.filters.length} filter
                      </Badge>
                    )}
                  </div>
                </button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFavorite(favorite.id, favorite.name);
                  }}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Star className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Inga sparade sökningar än
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Spara dina mest använda sökningar för snabb åtkomst
          </p>
        </div>
      )}
    </div>
  );
}