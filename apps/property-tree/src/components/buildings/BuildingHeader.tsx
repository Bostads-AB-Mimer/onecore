
import { Building } from "@/types/api";
import { Building as BuildingIcon, Building2 } from "lucide-react";
import { PropertyBreadcrumb } from "@/components/navigation/Breadcrumb";

interface BuildingHeaderProps {
  building: Building;
  propertyName?: string;
}

export const BuildingHeader = ({ building, propertyName }: BuildingHeaderProps) => {
  return (
    <div className="space-y-4">
      <PropertyBreadcrumb />
      
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">{building.name}</h1>
        </div>
      </div>
    </div>
  );
};
