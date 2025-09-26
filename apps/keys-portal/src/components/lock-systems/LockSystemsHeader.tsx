import { Badge } from "@/components/ui/badge";

interface LockSystemsHeaderProps {
  totalLockSystems: number;
  displayedLockSystems: number;
}

export function LockSystemsHeader({ totalLockSystems, displayedLockSystems }: LockSystemsHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Låssystem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {displayedLockSystems} av {totalLockSystems} låssystem
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