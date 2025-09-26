export type KeyType = 'LGH' | 'PB' | 'FS' | 'HN';

export interface Key {
  id: string;
  key_name: string;
  key_sequence_number?: number;
  flex_number?: number;
  rental_object?: string;
  key_type: KeyType;
  key_system_id?: string;
  key_system_name?: string; // For display purposes
  created_at: string;
  updated_at: string;
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