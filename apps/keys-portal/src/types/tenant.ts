export interface Tenant {
  id: string;
  personnummer: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  tenant_id: string;
  rental_object: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  monthly_rent?: number;
  created_at: string;
  updated_at: string;
  tenant?: Tenant; // For joined queries
}

export type KeyLoanStatus = 'loaned' | 'returned';

export interface KeyLoan {
  id: string;
  key_id: string;
  contract_id: string;
  tenant_id: string;
  loaned_at: string;
  returned_at?: string;
  status: KeyLoanStatus;
  notes?: string;
  loaned_by?: string;
  returned_by?: string;
  created_at: string;
  updated_at: string;
  // For joined queries
  key?: {
    id: string;
    key_name: string;
    key_type: string;
    rental_object?: string;
  };
  contract?: Contract;
  tenant?: Tenant;
}