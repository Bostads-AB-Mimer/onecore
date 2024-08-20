import { Email } from './types';

interface ParkingSpaceOfferEmail extends Email {
  address: string;
  firstName: string;
  availableFrom: string;
  deadlineDate: string;
  rent: string;
  type: string;
  parkingSpaceId: string;
  objectId: string;
  hasParkingSpace: boolean;
}

// Can be used for both positive and negative notifications
interface ParkingSpaceNotificationEmail extends Email {
  address: string;
  parkingSpaceId: string;
}

export type {
  ParkingSpaceOfferEmail,
  ParkingSpaceNotificationEmail
}