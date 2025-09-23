export type KeyType = 'LGH' | 'PB' | 'FS' | 'HN';

export interface Key {
  id: string;
  keyName: string;
  keySequenceNumber?: number;
  flexNumber?: number;
  rentalObject?: string;
  keyType: KeyType;
  keySystemId?: string;
  keySystemName?: string; // For display purposes
  createdAt: string;
  updatedAt: string;
}

export interface KeySystem {
  id: string;
  name: string;
  code: string; // Like "ABC123"
}

export const KeyTypeLabels: Record<KeyType, string> = {
  'LGH': 'Lägenhet',
  'PB': 'Postbox', 
  'FS': 'Förråd/Source',
  'HN': 'Huvudnyckel'
};