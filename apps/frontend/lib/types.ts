export type ElectionMode = 'PREPARATION' | 'VOTING' | 'COUNTING' | 'COMPLETED';
export type AppRole = 'OBSERVER' | 'REGIONAL_ADMIN';
export type ResultCategoryCode = 'PAM' | 'PI' | 'RNI' | 'PJD' | 'USFP' | 'MP' | 'REJECTED';
export type ResultValues = Record<ResultCategoryCode, number>;

export type AppUser = {
  id: string;
  regional_office_id: string;
  username: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: AppRole;
  local_bureau_id?: string | null;
  active: boolean;
  must_change_password: boolean;
};

export type ResultCategory = {
  code: ResultCategoryCode;
  label: string;
  category_type: 'PARTY' | 'REJECTED';
  display_order: number;
};

export type ResultCorrection = {
  id: string;
  submission_id: string;
  category_code: ResultCategoryCode;
  old_value: number;
  proposed_value: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
};

export type BureauResult = {
  id: string;
  local_bureau_id: string;
  observer_id: string;
  status: 'CONFIRMED' | 'CORRECTION_PENDING' | 'CORRECTED';
  submitted_at: string;
  confirmed_at: string;
  updated_at: string;
  values: ResultValues;
  corrections: ResultCorrection[];
};

export type MeResponse = {
  user: AppUser;
  electionMode: ElectionMode;
  bureau: { id: string; code: string; name: string; address?: string | null; active: boolean } | null;
  participation: { currentCount: number; updatedAt?: string | null } | null;
  result: BureauResult | null;
  presence?: { last_seen_at: string; connection_status: string } | null;
};

export type ParticipationBureau = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  active: boolean;
  observer: { id: string; username: string; full_name: string; phone?: string | null; local_bureau_id: string; active: boolean } | null;
  currentCount: number;
  counterUpdatedAt: string | null;
  presence: { observer_id: string; local_bureau_id: string; last_seen_at: string; connection_status: string } | null;
};

export type ParticipationSnapshot = {
  electionMode: ElectionMode;
  thresholds: { orange_minutes: number; red_minutes: number };
  serverTime: string;
  bureaus: ParticipationBureau[];
};

export type ResultBureau = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  active: boolean;
  observer: { id: string; username: string; full_name: string; phone?: string | null; local_bureau_id: string } | null;
  result: BureauResult | null;
};

export type ResultsSnapshot = {
  electionMode: ElectionMode;
  serverTime: string;
  categories: ResultCategory[];
  categoryTotals: ResultValues;
  bureaus: ResultBureau[];
};

export type AdminBureau = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  active: boolean;
  observer: null | { id: string; username: string; full_name: string; phone?: string | null; local_bureau_id: string; active: boolean };
};

export type AdminUser = {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: AppRole;
  local_bureau_id?: string | null;
  active: boolean;
  must_change_password: boolean;
  last_login_at?: string | null;
};
