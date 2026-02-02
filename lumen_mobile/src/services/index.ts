/**
 * API Services
 * =============
 * Funções de chamada à API organizadas por domínio.
 */

import api from './api';
import {
  User,
  Profile,
  ProfileUpdateRequest,
  EmergencyContact,
  EmergencyContactRequest,
  Catalog,
  LatestLegal,
  AcceptLegalRequest,
  AcceptLegalResponse,
  OrgTree,
  Membership,
  MembershipRequest,
  StartVerificationRequest,
  StartVerificationResponse,
  ConfirmVerificationRequest,
  ConfirmVerificationResponse,
  HealthResponse,
} from '@/types';

// =============================================================================
// HEALTH
// =============================================================================
export const healthService = {
  check: () => api.get<HealthResponse>('/health'),
};

// =============================================================================
// AUTH
// =============================================================================
export const authService = {
  getMe: () => api.get<User>('/me'),
  
  // DEV only
  devLogin: async (email: string) => {
    const userId = email.split('@')[0];
    await api.setDevToken(userId, email);
    return authService.getMe();
  },
  
  logout: () => api.clearToken(),
};

// =============================================================================
// PROFILE
// =============================================================================
export const profileService = {
  getCatalogs: () => api.get<Catalog[]>('/profile/catalogs'),
  
  getProfile: () => api.get<Profile>('/profile'),
  
  updateProfile: (data: ProfileUpdateRequest) => 
    api.put<Profile>('/profile', data),
  
  addEmergencyContact: (data: EmergencyContactRequest) =>
    api.post<EmergencyContact>('/profile/emergency-contact', data),
};

// =============================================================================
// LEGAL
// =============================================================================
export const legalService = {
  getLatest: () => api.get<LatestLegal>('/legal/latest'),
  
  accept: (data: AcceptLegalRequest) =>
    api.post<AcceptLegalResponse>('/legal/accept', data),
};

// =============================================================================
// ORGANIZATION
// =============================================================================
export const orgService = {
  getTree: () => api.get<OrgTree>('/org-units/tree'),
};

// =============================================================================
// MEMBERSHIP
// =============================================================================
export const membershipService = {
  getMyMemberships: () => api.get<Membership[]>('/org-memberships/my'),
  
  request: (data: MembershipRequest) =>
    api.post<Membership>('/org-memberships/request', data),
};

// =============================================================================
// VERIFICATION
// =============================================================================
export const verificationService = {
  startPhone: (data: StartVerificationRequest) =>
    api.post<StartVerificationResponse>('/verify/phone/start', data),
  
  confirmPhone: (data: ConfirmVerificationRequest) =>
    api.post<ConfirmVerificationResponse>('/verify/phone/confirm', data),
};

// Export all services
export default {
  health: healthService,
  auth: authService,
  profile: profileService,
  legal: legalService,
  org: orgService,
  membership: membershipService,
  verification: verificationService,
};
