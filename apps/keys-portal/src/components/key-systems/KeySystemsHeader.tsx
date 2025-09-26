import { Badge } from "@/components/ui/badge";

interface KeySystemsHeaderProps {
  totalKeySystems: number;
  displayedKeySystems: number;
}

export function KeySystemsHeader({ totalKeySystems, displayedKeySystems }: KeySystemsHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Låssystem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {displayedKeySystems} av {totalKeySystems} låssystem
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="text-xs">
          Mimer Nyckelhantering
        </Badge>
      </div>
    </div>
  );
}