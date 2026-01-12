export type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'date'

export interface FieldConfig {
  name: string
  label: string
  type: FieldType
  required: boolean
  defaultValue?: any
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

export interface EntityDialogConfig {
  createTitle: string
  editTitle: string
  fields: FieldConfig[]
}

export const entityDialogConfig: Record<
  'category' | 'type' | 'subtype' | 'model' | 'instance',
  EntityDialogConfig
> = {
  category: {
    createTitle: 'Skapa ny kategori',
    editTitle: 'Redigera kategori',
    fields: [
      {
        name: 'categoryName',
        label: 'Namn',
        type: 'text',
        required: true,
        placeholder: 'T.ex. VVS, El, Ventilation',
      },
      {
        name: 'description',
        label: 'Beskrivning',
        type: 'text',
        required: true,
        placeholder: 'Beskriv kategorin',
      },
    ],
  },
  type: {
    createTitle: 'Skapa ny typ',
    editTitle: 'Redigera typ',
    fields: [
      {
        name: 'typeName',
        label: 'Namn',
        type: 'text',
        required: true,
        placeholder: 'T.ex. Radiatorer, Kranar, Rör',
      },
      {
        name: 'description',
        label: 'Beskrivning',
        type: 'text',
        required: false,
        placeholder: 'Valfri beskrivning',
      },
    ],
  },
  subtype: {
    createTitle: 'Skapa ny undertyp',
    editTitle: 'Redigera undertyp',
    fields: [
      {
        name: 'subTypeName',
        label: 'Namn',
        type: 'text',
        required: true,
        placeholder: 'T.ex. Termostatventil, Blandare',
      },
      {
        name: 'xpandCode',
        label: 'Xpand-kod',
        type: 'text',
        required: false,
        placeholder: 'Valfritt',
      },
      {
        name: 'depreciationPrice',
        label: 'Avskrivningspris (kr)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'technicalLifespan',
        label: 'Teknisk livslängd (år)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'economicLifespan',
        label: 'Ekonomisk livslängd (år)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'replacementIntervalMonths',
        label: 'Underhållsintervall (månader)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'quantityType',
        label: 'Kvantitetstyp',
        type: 'select',
        required: true,
        defaultValue: 'UNIT',
        options: [
          { value: 'UNIT', label: 'Styck' },
          { value: 'METER', label: 'Meter' },
          { value: 'SQUARE_METER', label: 'Kvadratmeter' },
          { value: 'CUBIC_METER', label: 'Kubikmeter' },
        ],
      },
    ],
  },
  model: {
    createTitle: 'Skapa ny modell',
    editTitle: 'Redigera modell',
    fields: [
      {
        name: 'modelName',
        label: 'Modellnamn',
        type: 'text',
        required: true,
        placeholder: 'T.ex. RA 2994',
      },
      {
        name: 'manufacturer',
        label: 'Tillverkare',
        type: 'text',
        required: true,
        placeholder: 'T.ex. Danfoss',
      },
      {
        name: 'currentPrice',
        label: 'Nuvarande pris (kr)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'currentInstallPrice',
        label: 'Installationspris (kr)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'warrantyMonths',
        label: 'Garanti (månader)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'dimensions',
        label: 'Dimensioner',
        type: 'text',
        required: false,
        placeholder: 'T.ex. 500x300x150 mm',
      },
      {
        name: 'coclassCode',
        label: 'CoClass-kod',
        type: 'text',
        required: false,
        placeholder: 'Valfritt',
      },
      {
        name: 'technicalSpecification',
        label: 'Teknisk specifikation',
        type: 'textarea',
        required: false,
        placeholder: 'Detaljerad teknisk beskrivning',
      },
      {
        name: 'installationInstructions',
        label: 'Installationsinstruktioner',
        type: 'textarea',
        required: false,
        placeholder: 'Instruktioner för installation',
      },
    ],
  },
  instance: {
    createTitle: 'Skapa komponent',
    editTitle: 'Redigera komponent',
    fields: [
      {
        name: 'serialNumber',
        label: 'Serienummer',
        type: 'text',
        required: true,
        placeholder: 'Unikt serienummer',
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'ACTIVE',
        options: [
          { value: 'ACTIVE', label: 'Aktiv' },
          { value: 'INACTIVE', label: 'Inaktiv' },
          { value: 'MAINTENANCE', label: 'Underhåll' },
          { value: 'DECOMMISSIONED', label: 'Ur drift' },
        ],
      },
      {
        name: 'condition',
        label: 'Skick',
        type: 'select',
        required: false,
        options: [
          { value: '', label: 'Ej angivet' },
          { value: 'NEW', label: 'Nyskick' },
          { value: 'GOOD', label: 'Gott skick' },
          { value: 'FAIR', label: 'Godtagbart skick' },
          { value: 'POOR', label: 'Dåligt skick' },
          { value: 'DAMAGED', label: 'Skadat' },
        ],
      },
      {
        name: 'quantity',
        label: 'Antal',
        type: 'number',
        required: true,
        defaultValue: 1,
      },
      {
        name: 'priceAtPurchase',
        label: 'Inköpspris (kr)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'depreciationPriceAtPurchase',
        label: 'Avskrivningspris (kr)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'warrantyMonths',
        label: 'Garanti (månader)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'warrantyStartDate',
        label: 'Garantistartdatum',
        type: 'date',
        required: false,
        placeholder: '',
      },
      {
        name: 'economicLifespan',
        label: 'Ekonomisk livslängd (år)',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'ncsCode',
        label: 'NCS-kod',
        type: 'text',
        required: false,
        placeholder: 'Valfritt',
      },
      {
        name: 'specifications',
        label: 'Specifikationer (komponent-specifik)',
        type: 'textarea',
        required: false,
        placeholder:
          'Ytterligare tekniska specifikationer för denna specifika komponent',
      },
      {
        name: 'additionalInformation',
        label: 'Övrig information',
        type: 'textarea',
        required: false,
        placeholder: 'Annan viktig information om komponenten',
      },
    ],
  },
}
