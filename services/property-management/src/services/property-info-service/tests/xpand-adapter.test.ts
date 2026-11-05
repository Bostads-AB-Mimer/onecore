import { transformFromDbRentalPropertyInfo } from '../adapters/xpand-adapter'

const baseRow = [
  {
    keycmobt: 'balgh',
    rental_property_id: '705-022-04-0201',
    address: 'STENTORPSGATAN 9 A',
    entrance: '04',
    estate_code: '02301',
    estate: 'KOLAREN 1',
    building_code: '705-022',
    building: 'STENTORPSGATAN 7-9',
    rental_type_code: 'STD',
    rental_type: 'Bostadskontrakt',
    commercial_space_code: null,
    commercial_space_type: null,
    parking_space_code: null,
    apartment_code: '0201',
    apartment_number: '1101',
    apartment_type_code: 'LGH',
    apartment_type: '3 rum och kök',
    floor: '2',
    has_elevator: 0,
    wash_space: 'B',
    apartment_area: 73,
    districtCode: '61132',
    district: 'Distrikt Öst',
    marketAreaCode: '011',
    marketArea: 'Göteborg',
    building_construction_year: 1956,
    building_renovation_year: 2015,
    building_assessment_year: 2020,
    building_type_code: 'FLER',
    building_type_caption: 'Flerbostadshus',
    street: 'STENTORPSGATAN 9 A',
    street2: null,
    postal_code: '72216',
    city: 'Västerås',
  },
]

describe('transformFromDbRentalPropertyInfo', () => {
  describe('districtCode and district', () => {
    it('maps districtCode from db row', () => {
      const result = transformFromDbRentalPropertyInfo(baseRow)
      expect(result.districtCode).toBe('61132')
    })

    it('maps district from db row', () => {
      const result = transformFromDbRentalPropertyInfo(baseRow)
      expect(result.district).toBe('Distrikt Öst')
    })
  })

  describe('marketArea', () => {
    it('maps marketAreaCode from db row', () => {
      const result = transformFromDbRentalPropertyInfo(baseRow)
      expect(result.marketAreaCode).toBe('011')
    })

    it('maps marketArea from db row', () => {
      const result = transformFromDbRentalPropertyInfo(baseRow)
      expect(result.marketArea).toBe('Göteborg')
    })
  })

  describe('building', () => {
    it('maps all building fields', () => {
      const result = transformFromDbRentalPropertyInfo(baseRow)
      expect(result.building).toMatchObject({
        buildingCode: '705-022',
        building: 'STENTORPSGATAN 7-9',
        constructionYear: 1956,
        renovationYear: 2015,
        assessmentYear: 2020,
        buildingTypeCode: 'FLER',
        buildingTypeCaption: 'Flerbostadshus',
      })
    })

    it('maps null construction year when missing in db', () => {
      const row = [{ ...baseRow[0], building_construction_year: null }]
      const result = transformFromDbRentalPropertyInfo(row)
      expect(result.building.constructionYear).toBeNull()
    })

    it('maps null renovation year when missing in db', () => {
      const row = [{ ...baseRow[0], building_renovation_year: null }]
      const result = transformFromDbRentalPropertyInfo(row)
      expect(result.building.renovationYear).toBeNull()
    })

    it('maps null assessment year when missing in db', () => {
      const row = [{ ...baseRow[0], building_assessment_year: null }]
      const result = transformFromDbRentalPropertyInfo(row)
      expect(result.building.assessmentYear).toBeNull()
    })
  })

  describe('address', () => {
    it('maps street, postalCode and city from db row', () => {
      const result = transformFromDbRentalPropertyInfo(baseRow)
      expect(result.address).toMatchObject({
        street: 'STENTORPSGATAN 9 A',
        postalCode: '72216',
        city: 'Västerås',
      })
    })

    it('maps street2 when present', () => {
      const row = [{ ...baseRow[0], street2: 'c/o Testsson' }]
      const result = transformFromDbRentalPropertyInfo(row)
      expect(result.address?.street2).toBe('c/o Testsson')
    })

    it('street2 is null when not present in db', () => {
      const row = [{ ...baseRow[0], street2: null }]
      const result = transformFromDbRentalPropertyInfo(row)
      expect(result.address?.street2).toBeNull()
    })
  })

  describe('apartment without building metadata', () => {
    it('maps empty strings on property when building enrichment is missing', () => {
      const row = [
        {
          ...baseRow[0],
          building_code: null,
          building: null,
          building_construction_year: null,
          building_renovation_year: null,
          building_assessment_year: null,
          building_type_code: null,
          building_type_caption: null,
        },
      ]

      const result = transformFromDbRentalPropertyInfo(row)

      expect(result.type).toBe('Lägenhet')
      expect(result.property).toMatchObject({
        buildingCode: '',
        building: '',
      })
      expect(result.building.buildingCode).toBeNull()
    })
  })

  describe('commercial space without building metadata', () => {
    it('maps empty strings on property when building enrichment is missing', () => {
      const row = [
        {
          ...baseRow[0],
          keycmobt: 'balok',
          commercial_space_code: '0101',
          commercial_space_type: 'Butik',
          apartment_code: null,
          apartment_number: null,
          apartment_type_code: null,
          apartment_type: null,
          floor: null,
          has_elevator: null,
          wash_space: null,
          apartment_area: null,
          building_code: null,
          building: null,
          building_construction_year: null,
          building_renovation_year: null,
          building_assessment_year: null,
          building_type_code: null,
          building_type_caption: null,
        },
      ]

      const result = transformFromDbRentalPropertyInfo(row)

      expect(result.type).toBe('Lokal')
      expect(result.property).toMatchObject({
        buildingCode: '',
        building: '',
      })
      expect(result.building.buildingCode).toBeNull()
    })
  })

  describe('parking space without building', () => {
    it('maps parking space when building enrichment is missing', () => {
      const row = [
        {
          keycmobt: 'babps',
          rental_property_id: '211-741-00-0015',
          address: 'GÅSMYREGATAN 10',
          entrance: null,
          estate_code: '04305',
          estate: 'GERHARD 8',
          building_code: null,
          building: null,
          rental_type_code: 'STD',
          rental_type: 'Standard hyresobjektstyp',
          commercial_space_code: null,
          commercial_space_type: null,
          parking_space_code: '0015',
          apartment_code: null,
          apartment_number: null,
          apartment_type_code: null,
          apartment_type: null,
          floor: null,
          has_elevator: null,
          wash_space: null,
          apartment_area: null,
          districtCode: '61147',
          district: 'Distrikt Väster',
          marketAreaCode: null,
          marketArea: null,
          building_construction_year: null,
          building_renovation_year: null,
          building_assessment_year: null,
          building_type_code: null,
          building_type_caption: null,
          street: null,
          street2: null,
          postal_code: null,
          city: null,
        },
      ]

      const result = transformFromDbRentalPropertyInfo(row)

      expect(result.type).toBe('Bilplats')
      expect(result.id).toBe('211-741-00-0015')
      expect(result.property).toMatchObject({
        code: '0015',
        address: 'GÅSMYREGATAN 10',
      })
      expect(result.building.buildingCode).toBeNull()
      expect(result.marketAreaCode).toBeNull()
    })
  })
})
