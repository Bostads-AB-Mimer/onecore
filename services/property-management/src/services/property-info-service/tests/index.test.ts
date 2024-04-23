import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as materialOptionsAdapter from '../adapters/material-options-adapter'
import * as roomTypesAdapter from '../adapters/contech-os-adapter'
import * as xpandAdapter from '../adapters/xpand-adapter'
import {
  RentalPropertyInfo,
  ParkingSpace,
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
} from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('propery-info-service index', () => {
  describe('GET /rentalPropertyInfo/:id', () => {
    let rentalPropertyInfoMock: RentalPropertyInfo
    beforeEach(() => {
      rentalPropertyInfoMock = {
        id: '705-022-04-0201',
        type: 'Apartment',
        property: {
          rentalTypeCode: 'KORTTID',
          rentalType: 'Korttidskontrakt',
          address: 'STENTORPSGATAN 9 A',
          code: '0201',
          number: '1101',
          type: '3 rum och kök',
          entrance: '04',
          floor: '2',
          hasElevator: false,
          washSpace: 'B',
          area: 73,
          estateCode: '02301',
          estate: 'KOLAREN 1',
          buildingCode: '705-022',
          building: 'STENTORPSGATAN 7-9',
        },
        maintenanceUnits: [
          {
            estateCode: '02301',
            estate: 'KOLAREN 1',
            code: '705Y01',
            caption: 'Skötselyta/Mark',
            typeCode: null,
            typeCaption: null,
          },
          {
            estateCode: '02301',
            estate: 'KOLAREN 1',
            code: '705S18',
            caption: 'STENTORPG. 1-13, 2-16',
            typeCode: 'TRS',
            typeCaption: 'Trappstädning',
          },
          {
            estateCode: '02301',
            estate: 'KOLAREN 1',
            code: '705T17',
            caption: 'TVÄTTSTUGA Stentorpsgatan 13 B',
            typeCode: 'TVÄTTSTUGA',
            typeCaption: 'Tvättstuga',
          },
          {
            estateCode: '02301',
            estate: 'KOLAREN 1',
            code: '705M03',
            caption: 'Miljöbod Ö48 Stentorpsg. 13',
            typeCode: 'MILJÖBOD',
            typeCaption: 'Miljöbod',
          },
          {
            estateCode: '02301',
            estate: 'KOLAREN 1',
            code: '705S12',
            caption: 'SKYDDSRUM Stentorpsgatan 9 C',
            typeCode: 'SKY',
            typeCaption: 'Skyddsrum',
          },
          {
            estateCode: '02301',
            estate: 'KOLAREN 1',
            code: '705L08',
            caption: 'STENTORPSGATAN 7',
            typeCode: 'LEKPLATS',
            typeCaption: 'Lekplats',
          },
        ],
      }
    })
    it('responds with an object', async () => {
      const getRentalPropertyInfoSpy = jest
        .spyOn(xpandAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/rentalPropertyInfo/705-022-04-0201'
      )
      expect(res.status).toBe(200)
      expect(res.body).toBeInstanceOf(Object)
      expect(getRentalPropertyInfoSpy).toHaveBeenCalled()
    })
  })

  describe('GET /rentalproperties/:apartmentId/rooms-with-material-choices', () => {
    let roomTypes: any, choices: any

    beforeEach(() => {
      roomTypes = [
        { roomTypeId: 'BALKONG', name: 'BALKONG' },
        { roomTypeId: 'RUM 3', name: 'RUM 3' },
        { roomTypeId: 'VARDAGSRUM', name: 'VARDAGSRUM' },
        { roomTypeId: 'KLÄDKAMMARE', name: 'KLÄDKAMMARE' },
        { roomTypeId: 'HALL', name: 'HALL' },
        { roomTypeId: 'PASSAGE', name: 'PASSAGE' },
        { roomTypeId: 'BADRUM', name: 'BADRUM' },
        { roomTypeId: 'RUM 1', name: 'RUM 1' },
        { roomTypeId: 'WC', name: 'WC' },
        { roomTypeId: 'RUM 2', name: 'RUM 2' },
        { roomTypeId: 'TRAPP', name: 'TRAPP' },
        { roomTypeId: 'KÖK', name: 'KÖK' },
      ]
      choices = [
        {
          materialOptionGroupId: '40D5E637-2258-4F93-B036-D3BF169F497C',
          roomTypeId: 'BADRUM',
          name: 'Badrum',
          actionName: 'Välj mellan följande',
          materialOptions: [
            {
              materialOptionId: '9766DBA0-D5FB-41AF-BBA1-D90002A361AC',
              caption: 'Dusch',
              materialOptionGroupName: 'Badrum',
              images: [],
            },
          ],
          materialChoices: [
            {
              materialChoiceId: '0F4F93A9-7660-425E-BC7F-024CC6494F87',
              materialOptionId: '9766DBA0-D5FB-41AF-BBA1-D90002A361AC',
              materialOptionGroupId: '40D5E637-2258-4F93-B036-D3BF169F497C',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'BADRUM',
              status: 'Submitted',
            },
          ],
          type: 'SingleChoice',
        },
        {
          materialOptionGroupId: '4131ECA7-4428-4EE9-91E6-E7025348D36E',
          roomTypeId: 'BADRUM',
          name: 'Badrum',
          actionName: 'Tillval',
          materialOptions: [
            {
              materialOptionId: 'DB0EF877-0456-45BF-954E-A982D94B8871',
              caption: 'Kombimaskin',
              shortDescription: '+273 kr/mån',
              materialOptionGroupName: 'Badrum',
              images: [],
            },
            {
              materialOptionId: 'FB4C3E54-8CCB-4A56-9A11-83E38ECE79B5',
              caption: 'Tvättmaskin',
              shortDescription: '+265 kr/mån',
              materialOptionGroupName: 'Badrum',
              images: [],
            },
          ],
          materialChoices: [
            {
              materialChoiceId: '230BE85F-41C3-47F5-8D10-7F6F37A99C93',
              materialOptionId: 'DB0EF877-0456-45BF-954E-A982D94B8871',
              materialOptionGroupId: '4131ECA7-4428-4EE9-91E6-E7025348D36E',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'BADRUM',
              status: 'Submitted',
            },
            {
              materialChoiceId: 'DDCA4DF9-31ED-4ACC-A13E-5112961098E5',
              materialOptionId: 'FB4C3E54-8CCB-4A56-9A11-83E38ECE79B5',
              materialOptionGroupId: '4131ECA7-4428-4EE9-91E6-E7025348D36E',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'BADRUM',
              status: 'Submitted',
            },
          ],
          type: 'AddOn',
        },
        {
          materialOptionGroupId: '51210B9F-10EB-4B40-A92C-76C95FF3A982',
          roomTypeId: 'BADRUM',
          actionName: 'Välj koncept',
          materialOptions: [
            {
              materialOptionId: '526DBB88-E070-42FD-B0B8-2ABFF93F6AD9',
              caption: 'Koncept 1',
              shortDescription: 'Kort beskrivning av koncept 1',
              description: 'Lång beskrivning av koncept 1',
              coverImage: 'bad_koncept1.png',
              images: ['kok_koncept1_2.png', 'kok_koncept1_3.png'],
            },
          ],
          materialChoices: [
            {
              materialChoiceId: 'DD1C4490-6BB0-433E-AF14-3BCD859A37FB',
              materialOptionId: '526DBB88-E070-42FD-B0B8-2ABFF93F6AD9',
              materialOptionGroupId: '51210B9F-10EB-4B40-A92C-76C95FF3A982',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'BADRUM',
              status: 'Submitted',
            },
          ],
          type: 'Concept',
        },
        {
          materialOptionGroupId: '86DEF266-F70A-4C18-8CBD-287CAA592823',
          roomTypeId: 'RUM 1',
          name: 'Golv',
          actionName: 'Välj golv',
          materialOptions: [
            {
              materialOptionId: '0F7F17E2-3DF2-41E5-9C1D-7E0FCA9809CB',
              caption: 'Beige linoleum',
              coverImage: 'golv_beige.png',
              materialOptionGroupName: 'Golv',
              images: [],
            },
          ],
          materialChoices: [
            {
              materialChoiceId: '422E5EF1-ACDA-462A-BFE6-7C8DD28E3E77',
              materialOptionId: '0F7F17E2-3DF2-41E5-9C1D-7E0FCA9809CB',
              materialOptionGroupId: '86DEF266-F70A-4C18-8CBD-287CAA592823',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'RUM 1',
              status: 'Submitted',
            },
          ],
          type: 'Concept',
        },
        {
          materialOptionGroupId: 'AE473A5B-ADC8-44BB-A037-452E8424F0D9',
          roomTypeId: 'VARDAGSRUM',
          name: 'Väggar',
          actionName: 'Välj väggfärg',
          materialOptions: [
            {
              materialOptionId: '5FBF1D29-FD6C-4A57-9630-0ABDAE7276D2',
              caption: 'Ljusgrå',
              shortDescription: '10002Y',
              coverImage: 'vagg_ljusgra.png',
              materialOptionGroupName: 'Väggar',
              images: [],
            },
          ],
          materialChoices: [
            {
              materialChoiceId: '16511564-B007-4432-A467-BB9A87C91EA7',
              materialOptionId: '5FBF1D29-FD6C-4A57-9630-0ABDAE7276D2',
              materialOptionGroupId: 'AE473A5B-ADC8-44BB-A037-452E8424F0D9',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'VARDAGSRUM',
              status: 'Submitted',
            },
          ],
          type: 'Concept',
        },
        {
          materialOptionGroupId: 'CDFB7DDC-1D67-41B3-807B-AE3D89D758E6',
          roomTypeId: 'RUM 1',
          name: 'Väggar',
          actionName: 'Välj väggar',
          materialOptions: [
            {
              materialOptionId: 'CAF63230-8CA8-4752-BAB7-C2350B23DE70',
              caption: 'Varmvit',
              shortDescription: '20002Y',
              coverImage: 'vagg_varmvit.png',
              materialOptionGroupName: 'Väggar',
              images: [],
            },
          ],
          materialChoices: [
            {
              materialChoiceId: '8E8D5B67-261B-442F-A0C5-FE0DFA96DCCF',
              materialOptionId: 'CAF63230-8CA8-4752-BAB7-C2350B23DE70',
              materialOptionGroupId: 'CDFB7DDC-1D67-41B3-807B-AE3D89D758E6',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'RUM 1',
              status: 'Submitted',
            },
          ],
          type: 'Concept',
        },
        {
          materialOptionGroupId: 'D8A3362F-498C-49F5-8193-5E807919CD90',
          roomTypeId: 'KÖK',
          actionName: 'Välj koncept',
          materialOptions: [
            {
              materialOptionId: '9868AEA7-A897-4132-91AE-D6749F38067E',
              caption: 'Koncept 1',
              shortDescription: 'Kort beskrivning av koncept 1',
              description: 'Lång beskrivning av koncept 1',
              coverImage: 'kok_koncept1.png',
              images: ['kok_koncept1_3.png', 'kok_koncept1_2.png'],
            },
          ],
          materialChoices: [
            {
              materialChoiceId: '89DC78B8-6FF9-488A-AFC4-2451939216F4',
              materialOptionId: '9868AEA7-A897-4132-91AE-D6749F38067E',
              materialOptionGroupId: 'D8A3362F-498C-49F5-8193-5E807919CD90',
              apartmentId: '406-097-11-0201',
              roomTypeId: 'KÖK',
              status: 'Submitted',
            },
          ],
          type: 'Concept',
        },
      ]
    })

    it('responds', async () => {
      const roomTypesSpy = jest
        .spyOn(roomTypesAdapter, 'getRoomTypes')
        .mockResolvedValue(roomTypes)

      const materialChoicesSpy = jest
        .spyOn(materialOptionsAdapter, 'getMaterialChoicesByRoomTypes')
        .mockResolvedValue(choices)

      const res = await request(app.callback()).get(
        '/rentalproperties/406-097-11-0201/rooms-with-material-choices'
      )

      expect(res.status).toBe(200)
      expect(roomTypesSpy).toHaveBeenCalled()
      expect(materialChoicesSpy).toHaveBeenCalled()
      expect(res.body.roomTypes).toBeDefined()
    })

    it('returns choice data', async () => {
      const roomTypesSpy = jest
        .spyOn(roomTypesAdapter, 'getRoomTypes')
        .mockResolvedValue(roomTypes)

      const materialChoicesSpy = jest
        .spyOn(materialOptionsAdapter, 'getMaterialChoicesByRoomTypes')
        .mockResolvedValue(choices)

      const res = await request(app.callback()).get(
        '/rentalproperties/406-097-11-0201/rooms-with-material-choices'
      )

      expect(res.status).toBe(200)
      expect(roomTypesSpy).toHaveBeenCalled()
      expect(materialChoicesSpy).toHaveBeenCalled()
      expect(res.body.roomTypes).toBeDefined()
      expect(res.body.roomTypes.length).toBe(4)
      expect(res.body.roomTypes[0].materialOptionGroups.length).toBeGreaterThan(
        0
      )
      expect(
        res.body.roomTypes[0].materialOptionGroups[0].materialOptions.length
      ).toBe(1)
      expect(
        res.body.roomTypes[0].materialOptionGroups[0].materialOptions[0].caption
      ).toBe('Dusch')
      expect(
        res.body.roomTypes[0].materialOptionGroups[0].materialOptions[0]
          .materialOptionGroupName
      ).toBe('Badrum')
    })
  })
})

describe('GET /rentalproperties/:apartmentId/material-choices', () => {
  it('responds', async () => {
    const materialChoicesSpy = jest
      .spyOn(materialOptionsAdapter, 'getMaterialChoicesByApartmentId')
      .mockResolvedValue([
        {
          MaterialChoiceId: '0F4F93A9-7660-425E-BC7F-024CC6494F87',
          RoomType: 'BADRUM',
          Caption: 'Dusch',
          ShortDescription: null,
          ApartmentId: '406-097-11-0201',
        },
        {
          MaterialChoiceId: '16511564-B007-4432-A467-BB9A87C91EA7',
          RoomType: 'VARDAGSRUM',
          Caption: 'Ljusgrå',
          ShortDescription: '10002Y',
          ApartmentId: '406-097-11-0201',
        },
        {
          MaterialChoiceId: '230BE85F-41C3-47F5-8D10-7F6F37A99C93',
          RoomType: 'BADRUM',
          Caption: 'Kombimaskin',
          ShortDescription: '+273 kr/mån',
          ApartmentId: '406-097-11-0201',
        },
        {
          MaterialChoiceId: '422E5EF1-ACDA-462A-BFE6-7C8DD28E3E77',
          RoomType: 'RUM 1',
          Caption: 'Beige linoleum',
          ShortDescription: null,
          ApartmentId: '406-097-11-0201',
        },
        {
          MaterialChoiceId: '89DC78B8-6FF9-488A-AFC4-2451939216F4',
          RoomType: 'KÖK',
          Caption: 'Koncept 1',
          ShortDescription: 'Kort beskrivning av koncept 1',
          ApartmentId: '406-097-11-0201',
        },
        {
          MaterialChoiceId: '8E8D5B67-261B-442F-A0C5-FE0DFA96DCCF',
          RoomType: 'RUM 1',
          Caption: 'Varmvit',
          ShortDescription: '20002Y',
          ApartmentId: '406-097-11-0201',
        },
        {
          MaterialChoiceId: 'DD1C4490-6BB0-433E-AF14-3BCD859A37FB',
          RoomType: 'BADRUM',
          Caption: 'Koncept 1',
          ShortDescription: 'Kort beskrivning av koncept 1',
          ApartmentId: '406-097-11-0201',
        },
        {
          MaterialChoiceId: 'DDCA4DF9-31ED-4ACC-A13E-5112961098E5',
          RoomType: 'BADRUM',
          Caption: 'Tvättmaskin',
          ShortDescription: '+265 kr/mån',
          ApartmentId: '406-097-11-0201',
        },
      ])

    const res = await request(app.callback()).get(
      '/rentalproperties/406-097-11-0201/material-choices'
    )

    expect(res.status).toBe(200)
    expect(materialChoicesSpy).toHaveBeenCalled()
    expect(res.body.materialChoices).toBeDefined()
  })
})

describe('parking spaces', () => {
  describe('GET /parkingspaces/:id', () => {
    it('Gets and returns a parking space', async () => {
      const mockedParkingSpace: ParkingSpace = {
        address: {
          street: 'Parkeringsgatan',
          number: '1',
          city: 'Västerås',
          postalCode: '12345',
        },
        applicationCategory: ParkingSpaceApplicationCategory.internal,
        parkingSpaceId: '123-456-789',
        rent: {
          currentRent: {
            currentRent: 123,
            vat: 3,
            additionalChargeAmount: undefined,
            additionalChargeDescription: undefined,
            rentEndDate: undefined,
            rentStartDate: undefined,
          },
          futureRents: undefined,
        },
        vacantFrom: new Date(),
        type: ParkingSpaceType.Garage,
      }
      const getParkingPaceSpy = jest
        .spyOn(xpandAdapter, 'getParkingSpace')
        .mockResolvedValue(mockedParkingSpace)

      const res = await request(app.callback()).get(
        `/parkingspaces/${mockedParkingSpace.parkingSpaceId}`
      )

      expect(res.status).toBe(200)
      expect(getParkingPaceSpy).toHaveBeenCalledWith(
        mockedParkingSpace.parkingSpaceId
      )
      expect(res.body).toStrictEqual(
        JSON.parse(JSON.stringify(mockedParkingSpace))
      )
    })
  })
})
