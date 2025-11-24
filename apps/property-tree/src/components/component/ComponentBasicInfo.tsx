import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'

export default function ComponentBasicInfo() {
  // Dummy data based on componentModel and component entities
  const dummyData = {
    manufacturer: 'Bosch Thermotechnik',
    ncsCode: '23.31.21',
    coclassCode: 'EF.32.11',
    componentType: 'Värmepump',
    subtype: 'Bergvärme',
    currentPrice: 125000,
    warrantyMonths: 60,
    technicalLifespan: 20,
    economicLifespan: 15,
    dimensions: '1200x800x600 mm',
    quantityType: 'UNIT',
    replacementIntervalMonths: 240,
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatQuantityType = (type: string) => {
    const types: Record<string, string> = {
      UNIT: 'Styck',
      METER: 'Meter',
      SQUARE_METER: 'Kvadratmeter',
      CUBIC_METER: 'Kubikmeter',
    }
    return types[type] || type
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle>Grundläggande information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Tillverkare</p>
            <p className="font-medium">{dummyData.manufacturer}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Komponenttyp</p>
            <p className="font-medium">{dummyData.componentType}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Undertyp</p>
            <p className="font-medium">{dummyData.subtype}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">NCS-kod</p>
            <p className="font-medium">{dummyData.ncsCode}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">CoClass-kod</p>
            <p className="font-medium">{dummyData.coclassCode}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Aktuellt pris</p>
            <p className="font-medium">{formatPrice(dummyData.currentPrice)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Garantitid</p>
            <p className="font-medium">{dummyData.warrantyMonths} månader</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Teknisk livslängd</p>
            <p className="font-medium">{dummyData.technicalLifespan} år</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Ekonomisk livslängd</p>
            <p className="font-medium">{dummyData.economicLifespan} år</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Dimensioner</p>
            <p className="font-medium">{dummyData.dimensions}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Kvantitetstyp</p>
            <p className="font-medium">
              {formatQuantityType(dummyData.quantityType)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Bytesintervall</p>
            <p className="font-medium">
              {dummyData.replacementIntervalMonths} månader
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
