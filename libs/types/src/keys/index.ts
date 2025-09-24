// TODO: find out use, Remove in unused 


export type KeyType = 'LGH' | 'PB' | 'FS' | 'HN'
export type KeySystemType = 'MECHANICAL' | 'ELECTRONIC' | 'HYBRID'

export interface Key {
  id: string
  key_name: string
  key_sequence_number?: number
  flex_number?: number
  rental_object?: string
  key_type: KeyType
  key_system_id?: string | null
  created_at: string
  updated_at: string
}

export interface KeyLoan {
  id: string
  keys: string
  contact?: string
  lease?: string
  returned_at?: string | null
  available_to_next_tenant_from?: string | null
  picked_up_at?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
}

export interface KeySystem {
  id: string
  system_code: string
  name: string
  manufacturer?: string
  type: KeySystemType
  property_ids?: string
  installation_date?: string | null
  is_active?: boolean
  description?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
}

export interface Log {
  id: string
  user_name: string
  event_type: 'creation' | 'update' | 'delete'
  object_type: 'key' | 'key_system' | 'key_loan'
  event_time: string
  description?: string | null
}