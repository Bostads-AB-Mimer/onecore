import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { X } from "lucide-react";
import { SearchFilter, SearchResultType } from "@/types/search";

interface SearchFiltersProps {
  filters: SearchFilter[];
  onToggleFilter: (type: SearchResultType) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function SearchFilters({ 
  filters, 
  onToggleFilter, 
  onClearFilters, 
  hasActiveFilters 
}: SearchFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Filter</h4>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-6 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Rensa alla
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.type}
            variant={filter.active ? "default" : "outline"}
            size="sm"
            onClick={() => onToggleFilter(filter.type)}
            className="justify-start h-8 text-xs"
          >
            <span className="mr-2">{filter.icon}</span>
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <Badge variant="secondary" className="ml-auto h-4 text-xs">
                {filter.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Välj kategorier för att begränsa sökningen. Utan filter söks alla typer.
      </p>
    </div>
  );
}