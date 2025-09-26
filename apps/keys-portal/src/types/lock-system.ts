export type LockSystemType = 'MECHANICAL' | 'ELECTRONIC' | 'HYBRID';

export interface LockSystem {
  id: string;
  system_code: string;
  name: string;
  manufacturer?: string;
  managing_supplier?: string;
  type: LockSystemType;
  property_ids?: string[];
  installation_date?: string;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export const LockSystemTypeLabels: Record<LockSystemType, string> = {
  'MECHANICAL': 'Mekanisk',
  'ELECTRONIC': 'Elektronisk',
  'HYBRID': 'Hybrid'
};