import { LeaseStatus } from './enums';

interface Contact {
    contactCode: string //cmctc.cmctckod
    contactKey: string //cmtct.keycmctc
    leaseIds?: string[]
    leases?: Lease[]
    firstName: string
    lastName: string
    fullName: string
    nationalRegistrationNumber: string
    birthDate: Date
    address: Address | undefined
    phoneNumbers: PhoneNumber[] | undefined
    emailAddress: string,
    isTenant: boolean,
}

interface PhoneNumber {
    phoneNumber: string
    type: string
    isMainNumber: boolean
}

interface Lease {
    leaseId: string
    leaseNumber: string
    leaseStartDate: Date
    leaseEndDate: Date | undefined
    status: LeaseStatus
    tenantContactIds: string[] | undefined
    tenants: Contact[] | undefined
    rentalPropertyId: string
    rentalProperty: RentalProperty | undefined
    type: string
    rentInfo: RentInfo | undefined
    address: Address | undefined
    noticeGivenBy: string | undefined,
    noticeDate: Date | undefined,
    noticeTimeTenant: string | undefined,
    preferredMoveOutDate: Date | undefined,
    terminationDate: Date | undefined,
    contractDate: Date | undefined,
    lastDebitDate: Date | undefined,
    approvalDate: Date | undefined,
}

interface RentalProperty {
  rentalPropertyId: string;
  apartmentNumber: number;
  size: number;
  type: string;
  address: Address | undefined;
  rentalPropertyType: string;
  additionsIncludedInRent: string;
  otherInfo: string | undefined;
  roomTypes: Array<RoomType> | undefined;
  lastUpdated: Date | undefined;
}

interface Address {
  street: string;
  number: string;
  postalCode: string;
  city: string;
}

interface RentInfo {
  currentRent: Rent;
  futureRents: Array<Rent> | undefined;
}

interface Rent {
  rentId: string;
  leaseId: string;
  currentRent: number;
  additionalChargeDescription: string | undefined;
  additionalChargeAmount: number | undefined;
  rentStartDate: Date;
  rentEndDate: Date | undefined;
}

interface RoomType {
  roomTypeId: string;
  name: string;
  materialOptionGroups?: Array<MaterialOptionGroup>;
}

interface MaterialChoice {
  materialChoiceId: string;
  materialOptionId: string;
  materialOptionGroupId: string;
  apartmentId: string;
  roomTypeId: string;
  materialOption?: MaterialOption | undefined;
  materialOptionGroup?: MaterialOptionGroup | undefined;
  roomType?: RoomType | undefined;
  status: string; //TODO enum of Draft/Submitted/Cancelled
  dateOfSubmission?: Date;
  dateOfCancellation?: Date;
}

interface MaterialOptionGroup {
  materialOptionGroupId: string;
  roomTypeId: string;
  roomTypeName?: string;
  name?: string;
  actionName?: string;
  materialOptions?: Array<MaterialOption>;
  materialChoices?: Array<MaterialChoice>;
  type: string; //TODO enum of Concept/AddOn/SingleChoice
}

interface MaterialOption {
  materialOptionId: string;
  caption: string;
  shortDescription?: string;
  description?: string;
  coverImage?: string;
  images?: Array<string>;
  roomTypeName?: string;
  materialOptionGroupName?: string;
}

interface ConsumerReport {
  pnr: string;
  template: string;
  status: string;
  status_text: string;
  errorList: Array<ConsumerReportError> | [];
  name: string;
  address: string;
  zip: string;
  city: string;
}

interface ConsumerReportError {
  Cause_of_Reject: string;
  Reject_text: string;
  Reject_comment: string;
}

export {
  Contact,
  Lease,
  RentalProperty,
  Address,
  Rent,
  RentInfo,
  RoomType,
  MaterialOption,
  MaterialOptionGroup,
  MaterialChoice,
  ConsumerReport,
  ConsumerReportError,
};
