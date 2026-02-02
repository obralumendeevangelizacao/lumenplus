/**
 * Lumen+ Types
 * =============
 * Tipos compartilhados do app.
 */

// =============================================================================
// USER & AUTH
// =============================================================================
export interface User {
  user_id: string;
  is_active: boolean;
  identities: Identity[];
  profile_status: ProfileStatus;
  profile_completed_at: string | null;
  phone_verified: boolean;
  consents: ConsentsStatus;
  org_units: OrgUnitsInfo;
  memberships: Membership[];
  global_roles: string[];
}

export interface Identity {
  provider: string;
  provider_uid: string;
  email: string | null;
  email_verified: boolean;
}

export interface ConsentsStatus {
  status: 'pending' | 'accepted';
  pending_terms: boolean;
  pending_privacy: boolean;
}

export interface OrgUnitsInfo {
  direct_ids: string[];
  expanded_ids: string[];
}

export type ProfileStatus = 'INCOMPLETE' | 'PENDING_VERIFICATION' | 'COMPLETE';

// =============================================================================
// PROFILE
// =============================================================================
export interface Profile {
  user_id: string;
  full_name: string | null;
  birth_date: string | null;
  phone_e164: string | null;
  phone_verified: boolean;
  city: string | null;
  state: string | null;
  life_state_item_id: string | null;
  marital_status_item_id: string | null;
  vocational_reality_item_id: string | null;
  status: ProfileStatus;
  completed_at: string | null;
  emergency_contacts: EmergencyContact[];
  has_documents: boolean;
}

export interface ProfileUpdateRequest {
  full_name: string;
  birth_date: string;
  cpf: string;
  rg: string;
  phone_e164: string;
  city: string;
  state: string;
  life_state_item_id: string;
  marital_status_item_id: string;
  vocational_reality_item_id: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone_e164: string;
  relationship: string;
}

export interface EmergencyContactRequest {
  name: string;
  phone_e164: string;
  relationship: string;
}

// =============================================================================
// CATALOGS
// =============================================================================
export interface Catalog {
  code: string;
  name: string;
  items: CatalogItem[];
}

export interface CatalogItem {
  id: string;
  code: string;
  label: string;
}

// =============================================================================
// LEGAL
// =============================================================================
export interface LegalDocument {
  id: string;
  type: 'TERMS' | 'PRIVACY';
  version: string;
  content: string;
  published_at: string;
}

export interface LatestLegal {
  terms: LegalDocument | null;
  privacy: LegalDocument | null;
}

export interface AcceptLegalRequest {
  terms_version: string;
  privacy_version: string;
  analytics_opt_in?: boolean;
  push_opt_in?: boolean;
}

export interface AcceptLegalResponse {
  message: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
}

// =============================================================================
// ORGANIZATION
// =============================================================================
export interface OrgTree {
  sectors: Sector[];
  groups: Group[];
}

export interface Sector {
  id: string;
  name: string;
  slug: string;
  ministries: Ministry[];
}

export interface Ministry {
  id: string;
  name: string;
  slug: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
}

// =============================================================================
// MEMBERSHIP
// =============================================================================
export interface Membership {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: string;
  role_code: string;
  status: MembershipStatus;
  created_at: string;
}

export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED';

export interface MembershipRequest {
  org_unit_id: string;
}

// =============================================================================
// VERIFICATION
// =============================================================================
export interface StartVerificationRequest {
  phone_e164: string;
  channel: 'SMS' | 'WHATSAPP';
}

export interface StartVerificationResponse {
  verification_id: string;
  expires_at: string;
  debug_code?: string;
}

export interface ConfirmVerificationRequest {
  verification_id: string;
  code: string;
}

export interface ConfirmVerificationResponse {
  verified: boolean;
  message: string;
}

// =============================================================================
// API
// =============================================================================
export interface ApiError {
  detail: {
    error: string;
    message: string;
    field?: string;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}
