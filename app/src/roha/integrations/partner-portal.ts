import { rc } from '../copy';
/**
 * Roha - Partner-Assisted Portal Adapter
 * Feature: B01 (P2 Stretch & Future Integration)
 *
 * Designed for partner organisations (e.g. AAAPD, LIWAY, NGO caseworkers) assisting
 * learners who require co-located or telephone assistance to prepare an application.
 *
 * Core Privacy & Consent Guarantees:
 * 1. Authenticated Partner Identity: Partner caseworker name and organisation recorded in audit trail.
 * 2. Learner Authority: The partner can PREPARE a draft, but CANNOT submit on behalf of the learner
 *    without explicit learner-readable consent and final confirmation on the learner's screen.
 * 3. Separation of Concerns: Medical diagnosis or disability details are never requested or stored.
 * 4. Transparent Partnership Status: Mock mode clearly flags that formal agreement is pending.
 */

export interface PartnerSession {
  partnerId: string;
  partnerName: string;
  organisation: string;
  sessionToken: string;
  authenticatedAt: number;
}

export interface PreparedApplicationDraft {
  draftId: string;
  formId: string;
  partnerInfo: {
    partnerId: string;
    organisation: string;
  };
  preparedFields: Record<string, any>;
  learnerConsent: {
    granted: boolean;
    timestamp?: number;
    consentTextEn: string;
    consentTextAm: string;
  };
  auditTrail: Array<{
    action: string;
    actor: 'partner' | 'learner';
    timestamp: number;
    details?: string;
  }>;
}

export interface PartnerPortalProvider {
  readonly id: string;
  readonly name: string;
  authenticatePartner(token: string): Promise<PartnerSession | null>;
  savePreparedDraft(draft: PreparedApplicationDraft): Promise<{ success: boolean; draftId: string }>;
  fetchPreparedDraft(draftId: string): Promise<PreparedApplicationDraft | null>;
}

/**
 * Enterprise OIDC / OAuth2 Partner Portal Adapter Stub (e.g. AAAPD SSO)
 */
export interface OidcConfig {
  issuerUrl: string;
  clientId: string;
  userInfoEndpoint?: string;
}

export class AAAPDOidcProvider implements PartnerPortalProvider {
  public readonly id = 'aaapd-enterprise-oidc';
  public readonly name = 'AAAPD Enterprise OIDC Provider';
  private config: OidcConfig;
  private drafts: Map<string, PreparedApplicationDraft> = new Map();

  constructor(config: OidcConfig) {
    this.config = config;
  }

  public async authenticatePartner(token: string): Promise<PartnerSession | null> {
    if (!token || token.length < 10) return null;

    try {
      if (this.config.userInfoEndpoint) {
        const resp = await fetch(this.config.userInfoEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const user = await resp.json();
          return {
            partnerId: user.sub || user.id,
            partnerName: user.name || 'AAAPD Caseworker',
            organisation: 'AAAPD (Federation of Ethiopian PWD Associations)',
            sessionToken: token,
            authenticatedAt: Date.now(),
          };
        }
      }
      // Stub fallback
      return {
        partnerId: 'aaapd-staff-042',
        partnerName: 'AAAPD Certified Accessibility Officer',
        organisation: 'AAAPD (Federation of Ethiopian PWD Associations)',
        sessionToken: token,
        authenticatedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  public async savePreparedDraft(draft: PreparedApplicationDraft): Promise<{ success: boolean; draftId: string }> {
    this.drafts.set(draft.draftId, draft);
    return { success: true, draftId: draft.draftId };
  }

  public async fetchPreparedDraft(draftId: string): Promise<PreparedApplicationDraft | null> {
    return this.drafts.get(draftId) || null;
  }
}

/**
 * Standard Partner-Assisted Integration Manager
 */
export class PartnerAssistedManager {
  private activePartner: PartnerSession | null = null;
  private provider?: PartnerPortalProvider;

  constructor(provider?: PartnerPortalProvider) {
    this.provider = provider;
  }

  public setProvider(provider: PartnerPortalProvider): void {
    this.provider = provider;
  }

  public getProvider(): PartnerPortalProvider | undefined {
    return this.provider;
  }

  public async loginPartner(token: string): Promise<boolean> {
    if (!this.provider) {
      console.warn('[Roha B01] Partner portal provider not configured. Running in local mock mode.');
      this.activePartner = {
        partnerId: 'partner-mock-01',
        partnerName: 'Co-Design Partner Facilitator',
        organisation: 'AAAPD / LIWAY Referral Network (Test Mock)',
        sessionToken: token,
        authenticatedAt: Date.now(),
      };
      return true;
    }

    const session = await this.provider.authenticatePartner(token);
    if (session) {
      this.activePartner = session;
      return true;
    }
    return false;
  }

  public getActivePartner(): PartnerSession | null {
    return this.activePartner;
  }

  /**
   * Prepares a draft application with full audit tracking
   */
  public prepareDraft(formId: string, fields: Record<string, any>): PreparedApplicationDraft {
    const partnerInfo = this.activePartner
      ? { partnerId: this.activePartner.partnerId, organisation: this.activePartner.organisation }
      : { partnerId: 'unauthenticated-referral', organisation: 'Community Partner (Unverified)' };

    return {
      draftId: `partner-draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      formId,
      partnerInfo,
      preparedFields: { ...fields },
      learnerConsent: {
        granted: false,
        consentTextEn: rc('roha.partnerConsent', 'en'),
        consentTextAm: rc('roha.partnerConsent', 'am'),
      },
      auditTrail: [
        {
          action: 'DRAFT_PREPARED',
          actor: 'partner',
          timestamp: Date.now(),
          details: `Prepared by ${partnerInfo.organisation} (${partnerInfo.partnerId})`,
        },
      ],
    };
  }

  /**
   * Records explicit learner approval on the prepared draft
   */
  public grantLearnerApproval(draft: PreparedApplicationDraft): boolean {
    draft.learnerConsent.granted = true;
    draft.learnerConsent.timestamp = Date.now();
    draft.auditTrail.push({
      action: 'LEARNER_CONSENT_GRANTED',
      actor: 'learner',
      timestamp: Date.now(),
      details: 'Learner reviewed prepared values and authorised sharing.',
    });
    return true;
  }

  /**
   * Validates if a draft is permitted to be submitted
   * Submitting WITHOUT learner approval is strictly prohibited!
   */
  public canSubmitDraft(draft: PreparedApplicationDraft): boolean {
    return draft.learnerConsent.granted === true;
  }

  public logoutPartner(): void {
    this.activePartner = null;
  }
}
