import axios from 'axios'
import { RentalProperty, RoomType } from '../../../common/types'
import Config from '../../../common/config'

const FK_SIZE = "Lägenhetsyta";
const FK_RENTAL_PROPERTY_TYPE = "Lägenhetstyp";
const FK_APARTMENT_NUMBER = "Lägenhetsnummer";
const FK_ADDRESS = "Lägenhetsadress";
const FK_ROOM_TYPE = "Rum i Lägenhet"

const getRentalProperty = async (
  rentalPropertyId: string
): Promise<RentalProperty> => {
  const url = `${Config.contechOs.url}`
  const response = await axios({
    method: 'post',
    url: url,
    headers: {
      'Ocp-Apim-Subscription-Key': 'a372e65dd6204183990487d891cb6b37',
    },
    data: {
      targetTitle: rentalPropertyId,
    },
  })

  const json = response.data
  const propertyId = json[0].target.title

  // Mock default values and overwrite with as much as possible with real data
  let apartmentNumber: number = Math.round(Math.random() * 1000);
  let size: number = Math.round(Math.random() * 200);
  let address: {
    street: string;
    number: string;
    postalCode: string;
    city: string;
  } = {
    street: 'Björnvägen',
    number: Math.round(Math.random() * 100).toString(),
    postalCode: '74212',
    city: 'Västerås',
  };
  let rentalPropertyType: string = Math.round((Math.random() + 0.1) * 6) + ' rum och kök';
  let type: string = Math.round((Math.random() + 0.1) * 6) + ' rum och kök';
  let otherInfo: undefined = undefined;
  let lastUpdated: undefined = undefined;

  json[0].links.forEach((link: { sources: any; linkTitle: any }) => {
    const sources = link.sources;
    
    if (sources.length > 0) {
      if (sources.length === 1) {
        const source = sources[0];
        const value = source.title;
        const forgeinKey = source.parentTitle;
        
        if (forgeinKey === FK_SIZE) {
          size = value;
        }
        if (forgeinKey === FK_RENTAL_PROPERTY_TYPE) {
          rentalPropertyType = value;
        }
        if (forgeinKey === FK_APARTMENT_NUMBER) {
          apartmentNumber = value;
        }
        if (forgeinKey === FK_ADDRESS) {
          const parts = value.match(/^([\s\S]+?)\s(\d+)$/); // Split into string and number
          address.street = parts[1];
          address.number = parts[2];
        }
      } else {
        console.log(`Link with multiple sources: ${link.linkTitle}`);
      }
    }
  });
  
  return {
    rentalPropertyId: propertyId,
    apartmentNumber: apartmentNumber,
    size: size,
    address: address,
    rentalPropertyType: rentalPropertyType,
    type: type,
    additionsIncludedInRent: '',
    otherInfo: otherInfo,
    lastUpdated: lastUpdated,
  }
}

const getRoomTypes = async (aparmentId: string): Promise<Array<RoomType>> => {
  const roomTypes: Array<RoomType> = [];
  const url = `${Config.contechOs.url}`
  const response = await axios({
    method: 'post',
    url: url,
    headers: {
      'Ocp-Apim-Subscription-Key': 'a372e65dd6204183990487d891cb6b37',
    },
    data: {
      targetTitle: aparmentId,
    },
  })
  response.data[0].links.forEach((link: { sources: any; linkTitle: any }) => {
    link.sources.forEach((source: { parentTitle: any; id: any; title: any; }) => {
      const foreignKey = source.parentTitle;
      if (foreignKey === FK_ROOM_TYPE) {
        roomTypes.push({
          roomTypeId: source.title,
          name: source.title
        })
      }
    });
  });
  return roomTypes;
}

const getRoomType = async (
  aparmentId: string,
  roomTypeId: string
): Promise<RoomType | undefined> => {
  /*Get real data*/
  const roomTypes = await getRoomTypes(aparmentId)

  return roomTypes.find(
    (roomType: RoomType) => roomType.roomTypeId == roomTypeId
  )
}

export { getRoomTypes, getRoomType, getRentalProperty }
