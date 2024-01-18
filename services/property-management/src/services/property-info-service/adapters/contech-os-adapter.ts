import { RentalProperty, RoomType } from '../../../common/types'

const getRentalProperty = async (
  rentalPropertyId: string
): Promise<RentalProperty> => {
  return {
    rentalPropertyId: '102-008-03-0202', //property-info.contact.RentalPropertyId
    apartmentNumber: 1207, //ContecOS data?
    size: 85, //contecOS data?
    address: {
      street: 'Gatvägen', //property-info.contact.Street
      number: '56', //property-info.contact.StreetNumber
      postalCode: '72266', //property-info.contact.PostalCode
      city: 'Västerås', //property-info.contact.City
  },
    //below fields needs to be investigated more, might be taken from ContecOS?
    rentalPropertyType: 'Bostadskontrakt', //property-info.lease.Type
    type: 'Kontraktsinnehavare', //property-info.contact.Type
    additionsIncludedInRent: '',
    otherInfo: '',
    lastUpdated: new Date('2024-01-17'),
  }
}

const getRoomTypes = async (aparmentId: string): Promise<Array<RoomType>> => {
  const roomTypes: Array<RoomType> = [
    { roomTypeId: 'BADRUM', name: 'BADRUM'},
    { roomTypeId: 'VARDAGSRUM', name: 'VARDAGSRUM'},
    { roomTypeId: 'RUM 1', name: 'RUM 1'},
    { roomTypeId: 'KÖK', name: 'KÖK'},
  ];

  return roomTypes;
}

export { getRoomTypes, getRentalProperty }
