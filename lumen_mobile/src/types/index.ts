/**
 * Lumen+ Types
 * =============
 * Tipos compartilhados do app.
 * Alinhados com os schemas do backend (app/schemas/).
 */

// =============================================================================
// USER & AUTH — alinhado com UserMeResponse (GET /auth/me)
// =============================================================================
export interface User {
  user_id: string;
  is_active: boolean;
  identities: Identity[];
  profile_status: ProfileStatus;
  profile_completed_at: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  consents: ConsentsStatus;
  memberships: Membership[];
  pending_invites: Invite[];
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

export type ProfileStatus = 'INCOMPLETE' | 'PENDING_VERIFICATION' | 'COMPLETE';

// =============================================================================
// PROFILE
// =============================================================================
export interface Profile {
  user_id: string;
  full_name: string | null;
  birth_date: string | null;
  photo_url: string | null;
  phone_e164: string | null;
  phone_verified: boolean;
  city: string | null;
  state: string | null;
  life_state_item_id: string | null;
  marital_status_item_id: string | null;
  vocational_reality_item_id: string | null;
  consecration_year: number | null;
  has_vocational_accompaniment: boolean | null;
  vocational_accompanist_user_id: string | null;
  vocational_accompanist_name: string | null;
  interested_in_ministry: boolean | null;
  interested_ministry_id: string | null;
  ministry_interest_notes: string | null;
  // Informações adicionais
  instagram: string | null;
  dietary_restriction: boolean | null;
  dietary_restriction_notes: string | null;
  health_insurance: boolean | null;
  health_insurance_name: string | null;
  accommodation_preference: string | null;  // CAMA | REDE | COLCHAO_INFLAVEL
  is_from_mission: boolean | null;
  mission_name: string | null;
  despertar_encounter: string | null;
  // Música / Instrumentos
  plays_instrument: boolean | null;
  instrument_names: string[] | null;
  available_for_group: boolean | null;
  music_availability: string[] | null;
  // Contatos de emergência
  emergency_contacts: EmergencyContact[];
  // Status
  status: ProfileStatus;
  completed_at: string | null;
  has_documents: boolean;
  // Labels resolvidos pelo backend (ProfileWithLabelsOut)
  life_state_label: string | null;
  marital_status_label: string | null;
  vocational_reality_label: string | null;
  interested_ministry_name: string | null;
  vocational_accompanist_display_name: string | null;
}

export interface ProfileUpdateRequest {
  // Campos obrigatórios
  full_name: string;
  birth_date: string;       // ISO: YYYY-MM-DD
  phone_e164: string;       // E.164: +5511999999999
  city: string;
  state: string;            // UF (2 letras maiúsculas)
  // Campos opcionais
  cpf?: string | null;
  rg?: string | null;
  photo_url?: string | null;
  life_state_item_id?: string | null;
  marital_status_item_id?: string | null;
  vocational_reality_item_id?: string | null;
  consecration_year?: number | null;
  has_vocational_accompaniment?: boolean | null;
  vocational_accompanist_user_id?: string | null;
  vocational_accompanist_name?: string | null;
  interested_in_ministry?: boolean | null;
  interested_ministry_id?: string | null;
  ministry_interest_notes?: string | null;
  // Informações adicionais
  instagram?: string | null;
  dietary_restriction?: boolean | null;
  dietary_restriction_notes?: string | null;
  health_insurance?: boolean | null;
  health_insurance_name?: string | null;
  accommodation_preference?: string | null;
  is_from_mission?: boolean | null;
  mission_name?: string | null;
  despertar_encounter?: string | null;
  // Música / Instrumentos
  plays_instrument?: boolean | null;
  instrument_names?: string[] | null;
  available_for_group?: boolean | null;
  music_availability?: string[] | null;
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
  root: OrgUnitWithChildren | null;
}

export interface OrgUnitWithChildren {
  id: string;
  name: string;
  type: string;
  slug: string;
  children: OrgUnitWithChildren[];
}

// Mantido para compatibilidade com telas que usam a estrutura antiga de árvore
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
// MEMBERSHIP — alinhado com MembershipOut (GET /auth/me)
// =============================================================================
export interface Membership {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: string;
  retreat_scope?: boolean;
  role: string;         // era role_code — alinhado com backend (MembershipOut.role)
  status: MembershipStatus;
  joined_at: string;    // era created_at — alinhado com backend (MembershipOut.joined_at)
}

export type MembershipStatus = 'ACTIVE' | 'REMOVED';

// =============================================================================
// INVITES — alinhado com InviteOut (GET /auth/me → pending_invites)
// =============================================================================
export interface Invite {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: string;
  role: string;
  status: InviteStatus;
  message: string | null;
  invited_by_name: string;
  created_at: string;
  expires_at: string | null;
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

// Alinhado com InviteResponse do backend (schemas/organization.py)
// Campos: message, invite_id, status (não "id" — usar invite_id)
export interface InviteResponse {
  message: string;
  invite_id: string;  // UUID do convite (campo retornado pelo backend)
  status: string;
}

// =============================================================================
// INBOX — alinhado com InboxMessageResponse e InboxListResponse
// =============================================================================
export interface InboxMessage {
  id: string;           // InboxRecipient.id — usar para PATCH /{id}/read
  message_id: string;   // InboxMessage.id — identificador da mensagem
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string;
  attachments: Array<{ type: string; url: string; title?: string }> | null;
  sender_name: string | null;
}

export interface InboxListResponse {
  messages: InboxMessage[];
  total: number;
  unread_count: number;
}

export interface InboxSendRequest {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  send_to_all: boolean;
  scope_org_unit_id?: string | null;
  filters?: {
    vocational_reality_codes?: string[];
    life_state_codes?: string[];
    marital_status_codes?: string[];
    states?: string[];
    cities?: string[];
  } | null;
}

export interface OrgScopeResponse {
  id: string;
  name: string;
  type: string;
  member_count: number;
}

export interface SendScopesResponse {
  can_send_to_all: boolean;
  scopes: OrgScopeResponse[];
}

export interface InboxSendResponse {
  message_id: string;
  recipient_count: number;
  success: boolean;
}

export interface InboxPreviewResponse {
  recipient_count: number;
  filters_applied: Record<string, unknown> | null;
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

// Importado de utils/error — re-exportado aqui para compatibilidade
export type { ApiErrorDetail as ApiError } from '@/utils/error';

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}
