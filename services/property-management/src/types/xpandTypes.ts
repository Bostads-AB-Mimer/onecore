import {Address, ParkingSpaceType, ParkingSpaceApplicationCategory, RentInfo} from 'onecore-types'

//internal type for converting xpand service parking space objects to listing type
interface XpandParkingSpace {
    parkingSpaceId: string
    address: Address
    rent: RentInfo
    rentalObjectTypeCaption: string
    rentalObjectTypeCode: string 
    objectTypeCaption: string 
    objectTypeCode: string
    freeTable1Caption: string
    freeTable1Code: string
    freeTable3Caption: string
    freeTable3Code: string
    publishedFrom: Date
    publishedTo: Date
    vacantFrom: Date
    type: ParkingSpaceType
    applicationCategory: ParkingSpaceApplicationCategory
    waitingListType: string
}

export {
    XpandParkingSpace 
}