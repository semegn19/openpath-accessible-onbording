import { rc } from '../copy';
/**
 * Roha - Private Human Support & Handoff Adapter
 * Feature: B03 (P2 Stretch & Future Integration)
 *
 * Provides a learner-controlled escalation to a live human operator or community advocate.
 *
 * Core Privacy Guarantees:
 * 1. Explicit Context Preview: Shows the learner exactly what minimal info will be shared
 *    (e.g., current question name, preferred language, failure reason) BEFORE contacting the operator.
 * 2. No Silent Surveillance: Strictly NO silent screenshots, NO automated audio streaming,
 *    NO raw identity document bytes sent to the operator without active user opt-in.
 * 3. Separate Screen Sharing Gate: Screen sharing requires a secondary explicit learner consent action.
 * 4. Separate Privacy Class: Support requests are routed to welfare/advocate desks,
 *    never to potential employers or public application logs.
 */

export interface SupportContextPreview {
  currentStepName: string;
  language: string;
  errorOrObstacleMessage?: string;
  sharedFieldsAllowlist: string[];
  omittedSensitiveFields: string[];
  screenSharingOptIn: boolean;
}

export interface SupportTicket {
  ticketId: string;
  timestamp: number;
  channel: 'chat' | 'callback' | 'video-sign-language';
  contactPhoneOrHandle: string;
  context: SupportContextPreview;
  status: 'queued' | 'connected' | 'resolved';
}

export interface HumanSupportProvider {
  readonly id: string;
  readonly name: string;
  requestAgentConnection(ticket: SupportTicket): Promise<{ success: boolean; waitTimeEstimateMinutes?: number; error?: string }>;
  cancelRequest(ticketId: string): Promise<boolean>;
}

/**
 * WebRTC Human Support Provider Adapter Stub
 * Plugs into WebRTC signaling servers for direct audio/video/sign-language handoff.
 */
export interface WebRTCServerConfig {
  signalingUrl: string;
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

export class WebRTCCallCenterProvider implements HumanSupportProvider {
  public readonly id = 'webrtc-call-center';
  public readonly name = 'WebRTC Accessible Live Video/Audio Desk';
  private config: WebRTCServerConfig;

  constructor(config: WebRTCServerConfig) {
    this.config = config;
  }

  public async requestAgentConnection(ticket: SupportTicket): Promise<{ success: boolean; waitTimeEstimateMinutes?: number; error?: string }> {
    if (!this.config.signalingUrl) {
      console.log('[Roha B03 Mock WebRTC Call Center] Queued call ticket:', ticket.ticketId);
      return { success: true, waitTimeEstimateMinutes: 2 };
    }

    try {
      const resp = await fetch(this.config.signalingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          channel: ticket.channel,
          screenSharing: ticket.context.screenSharingOptIn,
          preferredLanguage: ticket.context.language,
          // Only send allowlisted non-sensitive context
          sharedContext: {
            step: ticket.context.currentStepName,
            error: ticket.context.errorOrObstacleMessage,
          },
        }),
      });

      if (resp.ok) {
        const json = await resp.json();
        return { success: true, waitTimeEstimateMinutes: json.waitTimeEstimate || 2 };
      }
      return { success: false, error: `Signaling server error HTTP ${resp.status}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async cancelRequest(_ticketId: string): Promise<boolean> {
    return true;
  }
}

/**
 * REST / Helpdesk Provider Adapter Stub (e.g. Zendesk, Freshdesk, Custom CRM)
 */
export class RestCallCenterProvider implements HumanSupportProvider {
  public readonly id = 'rest-call-center';
  public readonly name = 'REST Support Queue Gateway';
  private endpoint: string;
  private apiKey?: string;

  constructor(endpoint: string, apiKey?: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  public async requestAgentConnection(ticket: SupportTicket): Promise<{ success: boolean; waitTimeEstimateMinutes?: number; error?: string }> {
    if (!this.apiKey) {
      console.log(`[Roha B03 Mock REST Helpdesk] Ticket ${ticket.ticketId} queued`);
      return { success: true, waitTimeEstimateMinutes: 4 };
    }

    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(ticket),
      });

      if (resp.ok) {
        const data = await resp.json();
        return { success: true, waitTimeEstimateMinutes: data.estimatedWaitTime || 5 };
      }
      return { success: false, error: `Helpdesk HTTP ${resp.status}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async cancelRequest(_ticketId: string): Promise<boolean> {
    return true;
  }
}

/**
 * Human Handoff Orchestrator Manager
 */
export class HumanHandoffManager {
  private provider?: HumanSupportProvider;
  private activeTicket: SupportTicket | null = null;

  constructor(provider?: HumanSupportProvider) {
    this.provider = provider;
  }

  public setProvider(provider: HumanSupportProvider): void {
    this.provider = provider;
  }

  public getProvider(): HumanSupportProvider | undefined {
    return this.provider;
  }

  /**
   * Generates an honest preview of minimal context to be shared with human support.
   * Strips all sensitive disability details, identity numbers, and file attachments.
   */
  public generateContextPreview(
    currentStepName: string,
    language: string,
    allAnswers: Record<string, any>,
    errorMsg?: string,
    screenSharingOptIn: boolean = false
  ): SupportContextPreview {
    const shared: string[] = [];
    const omitted: string[] = [];

    // Fields that should never be sent to support operator without explicit reason
    const sensitiveKeywords = ['support', 'accommodation', 'id_number', 'passport', 'kebele', 'file', 'password', 'medical', 'disability'];

    for (const key of Object.keys(allAnswers)) {
      if (sensitiveKeywords.some((s) => key.toLowerCase().includes(s))) {
        omitted.push(key);
      } else {
        shared.push(key);
      }
    }

    return {
      currentStepName,
      language,
      errorOrObstacleMessage: errorMsg || rc('roha.supportRequested', language),
      sharedFieldsAllowlist: shared,
      omittedSensitiveFields: omitted,
      screenSharingOptIn,
    };
  }

  /**
   * Submits a support request only after learner reviews the preview and explicitly confirms
   */
  public async submitSupportRequest(
    channel: 'chat' | 'callback' | 'video-sign-language',
    contact: string,
    context: SupportContextPreview
  ): Promise<{ success: boolean; ticketId?: string; waitTime?: number; error?: string }> {
    const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ticket: SupportTicket = {
      ticketId,
      timestamp: Date.now(),
      channel,
      contactPhoneOrHandle: contact,
      context,
      status: 'queued',
    };

    this.activeTicket = ticket;

    if (!this.provider) {
      console.log('[Roha B03 Mock Support] Queued ticket:', ticketId, 'for contact:', contact);
      return {
        success: true,
        ticketId,
        waitTime: 3,
      };
    }

    let res;
    try { res = await this.provider.requestAgentConnection(ticket); }
    catch { res = { success: false }; }
    return {
      success: res.success,
      ticketId,
      waitTime: res.waitTimeEstimateMinutes,
      error: res.success ? undefined : rc('roha.supportFailed', context.language),
    };
  }

  public async cancelActiveTicket(): Promise<boolean> {
    if (!this.activeTicket) return true;
    if (this.provider) {
      await this.provider.cancelRequest(this.activeTicket.ticketId);
    }
    this.activeTicket = null;
    return true;
  }

  public getActiveTicket(): SupportTicket | null {
    return this.activeTicket;
  }
}
