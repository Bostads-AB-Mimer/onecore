import { Separator } from '@/components/ui/Separator'

interface SubComponentSpecs {
  ekonomiskLivslangd: string
  tekniskLivslangd: string
  year: string
  quantity: string
  brand: string
  model: string
}

interface MaintenanceSubComponentProps {
  name: string
  specs: SubComponentSpecs
}

export const MaintenanceSubComponent = ({
  name,
  specs,
}: MaintenanceSubComponentProps) => {
  return (
    <div className="bg-muted/30 rounded-md p-3">
      <h5 className="font-medium mb-2">{name}</h5>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-muted-foreground">Ekonomisk livslängd:</div>
        <div>{specs.ekonomiskLivslangd}</div>

        <div className="text-muted-foreground">Teknisk livslängd:</div>
        <div>{specs.tekniskLivslangd}</div>

        <div className="text-muted-foreground">Startår:</div>
        <div>{specs.year}</div>

        <div className="text-muted-foreground">Mängd:</div>
        <div>{specs.quantity}</div>

        <div className="text-muted-foreground">Märke:</div>
        <div>{specs.brand}</div>

        <div className="text-muted-foreground">Modell:</div>
        <div>{specs.model}</div>
      </div>
    </div>
  )
}
