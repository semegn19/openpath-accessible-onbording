/**
 * Roha - Drop-in Conversational Accessibility Agent SDK
 * Features: I01, D01-D06, A01-A05, V01-V05, P01-P03
 * One script works on any ordinary labelled website.
 */

import {
  DiscoveredPageMap,
  RohaCapabilities,
  RohaIntent,
  RohaMountOptions,
  Locale,
} from './types';
import { rc } from './copy';
import { FormGuide } from './form-guide';
import { ServerLLMProvider } from './providers/server-provider';
import { TargetRegistry } from './registry';
import { DiscoveryEngine } from './discovery';
import { IntentValidator } from './validator';
import { IntentRouter } from './router';
import { TextScaleExecutor } from './executors/text-scale';
import { SimpleModeExecutor } from './executors/simple-mode';
import { ContrastExecutor } from './executors/contrast';
import { ReadExecutor } from './executors/read';
import { FormActionExecutor } from './executors/form-action';
import { VoiceManager, VoiceState } from './voice';
import { ConversationManager } from './conversation';
import { RuntimeProfileManager } from './runtime-profile';
import { PageObserver } from './observer';
import { DraftService } from './drafts';
import {
  PartnerAssistedManager,
  SMSResumeService,
  HumanHandoffManager,
  PluggableWakeWordManager,
  WakeWordDetector,
} from './integrations';
import {
  LLMProvider,
  createLLMProvider,
  UniversalAPIConfig,
  OllamaLLMProvider,
  OpenAILLMProvider,
  GeminiLLMProvider,
  AnthropicLLMProvider,
  GenericRESTProvider,
  ChromeBuiltInAIProvider,
  MockLLMProvider,
} from './providers/llm-provider';

const bundleScript = typeof document !== 'undefined' ? document.currentScript as HTMLScriptElement | null : null;
const stylesheetURL = bundleScript?.src ? new URL('roha.css', bundleScript.src).href : '/roha.css';
let instanceCount = 0;

export class RohaSDK {
  private readonly instanceId = ++instanceCount;
  private requestVersion = 0;
  private aiEndpoint = '/api/assistant';
  private registry: TargetRegistry;
  private discovery: DiscoveryEngine;
  private validator: IntentValidator;
  private router: IntentRouter;
  private observer: PageObserver | null = null;
  private languageObserver: MutationObserver | null = null;

  // Executors
  private textScale: TextScaleExecutor;
  private simpleMode: SimpleModeExecutor;
  private contrast: ContrastExecutor;
  private readExecutor: ReadExecutor;
  private formAction: FormActionExecutor;
  private guide: FormGuide;

  // Managers
  private voice: VoiceManager;
  private conversation: ConversationManager;
  private runtimeProfile: RuntimeProfileManager;
  private drafts: DraftService;

  // Integrations (P2 Stretch & Post-Hackathon)
  private partnerManager: PartnerAssistedManager;
  private smsService: SMSResumeService;
  private humanHandoff: HumanHandoffManager;
  private wakeWordManager: PluggableWakeWordManager;

  // State
  private rootElement: HTMLElement | null = null;
  private currentMap: DiscoveredPageMap | null = null;
  private locale: Locale = 'en';
  private assistantPanel: HTMLElement | null = null;
  private liveRegion: HTMLElement | null = null;
  private isMounted: boolean = false;

  constructor() {
    this.registry = new TargetRegistry('roha-map-initial', 1);
    this.discovery = new DiscoveryEngine(this.registry);
    this.validator = new IntentValidator(this.registry);
    this.textScale = new TextScaleExecutor();
    this.simpleMode = new SimpleModeExecutor();
    this.contrast = new ContrastExecutor();
    this.readExecutor = new ReadExecutor(this.registry);
    this.formAction = new FormActionExecutor(this.registry);
    this.runtimeProfile = new RuntimeProfileManager();
    this.drafts = new DraftService();
    this.conversation = new ConversationManager();
    this.guide = new FormGuide(this.registry, this.formAction, () => this.rootElement, () => this.currentMap,
      () => this.locale, message => {
        if (['listening', 'processing', 'speaking'].includes(this.voice.getState())) this.readExecutor.speak(message, this.locale);
        this.announce(message);
      }, message => {
        const preview = this.assistantPanel?.querySelector<HTMLElement>('[data-roha-pending]');
        if (preview) {
          if (!message && preview.contains(document.activeElement)) {
            this.assistantPanel?.querySelector<HTMLInputElement>('[data-roha-control="roha-command"]')?.focus();
          }
          preview.hidden = !message;
          preview.querySelector('[data-roha-preview]')!.textContent = message || '';
        }
      });

    // Integrations
    this.partnerManager = new PartnerAssistedManager();
    this.smsService = new SMSResumeService();
    this.humanHandoff = new HumanHandoffManager();
    this.wakeWordManager = new PluggableWakeWordManager();
    this.wakeWordManager.setOnWakeAction(() => {
      this.voice.startListening(true);
    });

    // Voice manager
    this.voice = new VoiceManager(
      {
        onStateChange: (state: VoiceState, msg?: string) => {
          this.updateVoiceStatusUI(state, msg);
          if (msg) this.announce(msg);
        },
        onTranscript: (transcript: string, isFinal: boolean) => {
          this.updateTranscriptUI(transcript, isFinal);
          if (isFinal) {
          this.handleUserUtterance(transcript, false);
          }
        },
        onError: (err: string) => {
          this.announce(err);
        },
      },
      this.locale
    );

    // Initial dummy map for router
    this.currentMap = {
      schemaVersion: '2.0',
      mapId: 'init-map',
      mapVersion: 1,
      routeKey: 'init',
      locale: 'en',
      origin: 'runtime-discovery',
      resources: [],
    };
    this.router = new IntentRouter(this.registry, this.currentMap);

    // Sync speech speaking state with echo prevention
    this.readExecutor.setStatusCallback((status) => {
      this.voice.setEchoMute(status.speaking);
      if (status.text) {
        this.announce(rc('roha.reply', this.locale, { text: status.text }));
      }
    });

    // Remove legacy browser credentials. AI stays off until explicitly configured.
    try { window.localStorage.removeItem('roha_api_config'); } catch { /* storage may be blocked */ }
  }

  public mount(options: RohaMountOptions = {}): DiscoveredPageMap {
    if (this.isMounted) {
      this.unmount();
    }

    const root =
      typeof options.root === 'string'
        ? (document.querySelector(options.root) as HTMLElement)
        : options.root || (document.querySelector('#main') as HTMLElement) || document.body;

    this.rootElement = root;
    this.locale = options.language || (document.documentElement.lang.startsWith('am') ? 'am' : 'en');
    this.voice.setLocale(this.locale);
    this.conversation.setLocale(this.locale);
    this.smsService.setLocale(this.locale);
    if (this.rootElement) {
      this.textScale.setRootElement(this.rootElement.ownerDocument?.documentElement || this.rootElement);
    }

    if (options.runtimeProfile) {
      this.runtimeProfile.setProfile(options.runtimeProfile);
    }

    if (options.hostAdapter) {
      this.formAction.setHostAdapter(options.hostAdapter);
    }

    if (options.overrides) {
      this.discovery = new DiscoveryEngine(this.registry, options.overrides);
    }

    // 1. Initial Page Discovery
    this.currentMap = this.discovery.discover({
      root: this.rootElement,
      locale: this.locale,
    });

    this.validator.setMap(this.currentMap);
    this.router.updateMap(this.currentMap);
    this.conversation.loadFields(this.currentMap.resources);

    // 2. Start Page Observer for dynamic changes
    this.observer = new PageObserver({
      onMutation: () => {
        this.rescan();
      },
      onRouteChange: () => {
        this.rescan();
      },
    });
    this.observer.observe(this.rootElement);

    // 3. Render Roha Assistant Panel
    this.renderAssistantUI();

    this.isMounted = true;
    this.updateVoiceStatusUI(this.voice.getState());
    if (!options.language) {
      this.languageObserver = new MutationObserver(() => {
        this.setLanguage(document.documentElement.lang.startsWith('am') ? 'am' : 'en');
      });
      this.languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
    return this.currentMap;
  }

  public setLanguage(language: Locale): void {
    if (language === this.locale) return;
    this.requestVersion++;
    this.readExecutor.stop();
    this.locale = language;
    this.voice.setLocale(language);
    this.conversation.setLocale(language);
    this.smsService.setLocale(language);
    const provider = this.router.getLLMProvider();
    if (provider instanceof ServerLLMProvider) provider.consent(false);
    if (!this.isMounted) return;
    this.guide.reset();
    const activeControl = this.assistantPanel?.contains(document.activeElement)
      ? document.activeElement?.getAttribute('data-roha-control') : null;
    const draft = this.assistantPanel?.querySelector<HTMLInputElement>('[data-roha-control="roha-command"]')?.value || '';
    this.assistantPanel?.remove();
    this.assistantPanel = null;
    this.renderAssistantUI();
    const panel = this.assistantPanel as HTMLElement | null;
    const command = panel?.querySelector<HTMLInputElement>('[data-roha-control="roha-command"]');
    if (command) command.value = draft;
    if (activeControl) panel?.querySelector<HTMLElement>(`[data-roha-control="${activeControl}"]`)?.focus();
    this.updateVoiceStatusUI(this.voice.getState());
    this.rescan();
  }

  public unmount(): void {
    this.languageObserver?.disconnect();
    this.languageObserver = null;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.requestVersion++;
    const provider = this.router.getLLMProvider();
    if (provider instanceof ServerLLMProvider) provider.consent(false);
    this.guide.reset();
    this.voice.destroy();
    this.wakeWordManager.disable();
    this.readExecutor.stop();
    this.textScale.reset();
    this.contrast.reset();
    this.simpleMode.apply(false, this.rootElement || document.body);

    if (this.assistantPanel && this.assistantPanel.parentElement) {
      this.assistantPanel.parentElement.removeChild(this.assistantPanel);
      this.assistantPanel = null;
    }

    if (!document.querySelector('.roha-aside')) document.body.classList.remove('roha-layout');
    this.isMounted = false;
  }

  public rescan(): DiscoveredPageMap {
    if (!this.rootElement) {
      throw new Error('Roha is not mounted');
    }

    const nextVersion = (this.currentMap?.mapVersion || 0) + 1;
    this.currentMap = this.discovery.discover({
      root: this.rootElement,
      mapVersion: nextVersion,
      locale: this.locale,
    });

    this.validator.setMap(this.currentMap);
    this.router.updateMap(this.currentMap);
    this.conversation.refreshFieldLabels(this.currentMap.resources);
    this.guide.refresh();
    return this.currentMap;
  }

  public getMap(): DiscoveredPageMap {
    if (!this.currentMap) {
      throw new Error('No map generated yet');
    }
    return this.currentMap;
  }

  public getCapabilities(): RohaCapabilities {
    return this.runtimeProfile.getCapabilities();
  }

  public getDrafts(): DraftService {
    return this.drafts;
  }

  public getPartnerManager(): PartnerAssistedManager {
    return this.partnerManager;
  }

  public getSMSService(): SMSResumeService {
    return this.smsService;
  }

  public getHumanHandoffManager(): HumanHandoffManager {
    return this.humanHandoff;
  }

  public getWakeWordManager(): PluggableWakeWordManager {
    return this.wakeWordManager;
  }

  public attachWakeWordDetector(detector: WakeWordDetector): void {
    this.wakeWordManager.setDetector(detector);
  }

  public setLLMProvider(provider: LLMProvider): void {
    this.router.setLLMProvider(provider);
  }

  public configureAPI(config: UniversalAPIConfig): LLMProvider {
    if (config.apiKey || config.headers) throw new Error('Configure provider credentials in the server administrator settings.');
    const provider = createLLMProvider(config);
    this.setLLMProvider(provider);
    if (config.provider === 'server') this.aiEndpoint = config.endpoint || '/api/assistant';
    return provider;
  }

  public getLLMProvider(): LLMProvider | undefined {
    return this.router.getLLMProvider();
  }

  public getCompatibilityReport() {
    if (!this.currentMap) throw new Error('Roha is not mounted');
    return this.discovery.generateCompatibilityReport(this.currentMap);
  }

  public getOrientationSummary(): string {
    return this.conversation.getOrientationSummary(this.currentMap?.resources[0]?.name);
  }

  public getJobChecklist() {
    return this.conversation.getJobChecklist();
  }

  public normalizeSpokenDigits(str: string): string {
    return this.conversation.normalizeSpokenDigits(str);
  }

  public executeIntent(proposal: RohaIntent): { success: boolean; error?: string } {
    const validation = this.validator.validate(proposal);
    if (!validation.valid) {
      const err = `Intent validation rejected: ${validation.errors.join('; ')}`;
      this.announce(rc('roha.actionUnavailable', this.locale));
      return { success: false, error: err };
    }

    switch (proposal.intent) {
      case 'text_scale':
        this.textScale.apply(proposal.payload.percent);
        this.announce(rc('roha.textScaled', this.locale, { percent: proposal.payload.percent }));
        return { success: true };

      case 'simple_mode':
        this.simpleMode.apply(proposal.payload.enabled, this.rootElement || document.body, this.locale === 'am' ? 'am' : 'en');
        this.announce(rc(proposal.payload.enabled ? 'roha.simpleOn' : 'roha.simpleOff', this.locale));
        return { success: true };

      case 'contrast':
        this.contrast.applyContrast(proposal.payload.theme);
        this.announce(rc(proposal.payload.theme === 'high-contrast' ? 'roha.contrastOn' : 'roha.contrastOff', this.locale));
        return { success: true };

      case 'reduced_motion':
        this.contrast.applyReducedMotion(proposal.payload.enabled);
        this.announce(rc(proposal.payload.enabled ? 'roha.motionOn' : 'roha.motionOff', this.locale));
        return { success: true };

      case 'read':
        this.readExecutor.readTarget(proposal.targetId, this.locale);
        return { success: true };

      case 'explain':
        if (proposal.payload?.stuckReason) {
          const stuck = this.conversation.handleImStuck(proposal.payload.stuckReason, this.locale);
          this.readExecutor.speak(stuck.explanation, this.locale);
          this.announce(stuck.explanation);
          if (stuck.suggestedAction === 'simple_mode') {
            this.simpleMode.apply(true, this.rootElement || document.body, this.locale === 'am' ? 'am' : 'en');
          }
        } else if (proposal.targetId === 'page.main') {
          const orientation = this.conversation.getOrientationSummary(this.currentMap?.resources[0]?.name);
          this.readExecutor.speak(orientation, this.locale);
          this.announce(orientation);
        } else {
          this.readExecutor.speak(rc('roha.sectionHelp', this.locale, { name: this.currentMap?.resources.find(r => r.id === proposal.targetId)?.name || rc('roha.currentQuestion', this.locale) }), this.locale);
        }
        return { success: true };

      case 'review':
        this.guide.review();
        return { success: true };

      case 'focus':
      case 'navigate':
        this.closeAssistantForHostAction();
        if (proposal.payload?.direction === 'back') {
          const backBtn = (document.querySelector('.op-btn-back') || document.querySelector('button[aria-label*="Back"], button[aria-label*="ተመለስ"]')) as HTMLButtonElement;
          if (backBtn) {
            backBtn.click();
          } else {
            this.conversation.goBack();
          }
          this.announce(rc('roha.movedBack', this.locale));
        } else {
          const focused = this.formAction.focusTarget(proposal.targetId);
          return focused ? { success: true } : { success: false, error: 'Target could not receive focus' };
        }
        return { success: true };

      case 'filter':
        this.formAction.filterItems(proposal.targetId, proposal.payload.query);
        this.announce(rc('roha.filtered', this.locale, { query: proposal.payload.query }));
        return { success: true };

      case 'propose_answer':
        return { success: this.guide.propose(proposal.targetId, proposal.payload.value) };

      case 'choose_file':
        this.closeAssistantForHostAction();
        this.formAction.chooseFile(proposal.targetId);
        return { success: true };

      case 'request_submission':
        return { success: this.guide.submit(proposal.targetId) };

      case 'pause':
        this.guide.reset();
        this.readExecutor.stop();
        this.voice.stopListening();
        this.announce(rc('roha.paused', this.locale));
        return { success: true };

      case 'resume':
        const recap = this.conversation.getResumeRecap();
        this.readExecutor.speak(recap, this.locale);
        return { success: true };

      case 'undo':
        this.textScale.undo();
        this.conversation.undoLastAnswer();
        this.announce(rc('roha.undone', this.locale));
        return { success: true };

      case 'reset_preferences':
        this.textScale.reset();
        this.contrast.reset();
        this.simpleMode.apply(false, this.rootElement || document.body);
        this.announce(rc('roha.resetDone', this.locale));
        return { success: true };

      default:
        return { success: false, error: 'Unhandled intent execution' };
    }
  }

  public async handleUserUtterance(utterance: string, useProvider = true): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.rescan();
    if (this.guide.command(utterance)) return;
    if (/^(?:answer\s*:?\s+|my name is\s+|ስሜ\s+)/iu.test(utterance) && this.guide.answer(utterance)) return;
    // A field answer is accepted only after the user starts guided filling.
    const context = {
      activeTargetId: undefined,
      currentTextScalePercent: this.textScale.getPercent(),
      locale: this.locale,
    };

    // 1. Synchronous deterministic local route (0ms latency)
    // Note: executes synchronously before any await
    const localIntent = this.router.route(utterance, context);
    if (localIntent) {
      this.executeIntent(localIntent);
      return;
    }

    if (this.guide.answer(utterance)) return;

    // 2. Asynchronous LLM fallback if an LLMProvider is attached
    const llm = this.router.getLLMProvider();
    if (useProvider && llm && this.currentMap) {
      try {
        const llmIntent = await llm.interpret(utterance, this.currentMap, context);
        if (requestVersion !== this.requestVersion) return;
        if (llmIntent) {
          this.executeIntent(llmIntent);
          return;
        }
      } catch {
        if (llm instanceof ServerLLMProvider && !llm.hasConsent()) {
          const consent = this.assistantPanel?.querySelector<HTMLInputElement>('[data-ai-consent]');
          if (consent) { consent.checked = false; consent.disabled = true; }
          this.announce(rc('roha.providerChanged', this.locale));
          return;
        }
      }
    }

    if (requestVersion !== this.requestVersion) return;
    this.announce(rc('roha.notUnderstood', this.locale));
  }

  public announce(message: string): void {
    this.updateTranscriptUI(message, true);
    if (this.liveRegion) {
      this.liveRegion.textContent = message;
    }
  }

  private async enableVoice(): Promise<void> {
    const panel = this.assistantPanel;
    const button = panel?.querySelector<HTMLButtonElement>('[data-roha-control="roha-btn-mic"]');
    if (button) button.disabled = true;
    this.readExecutor.stop();
    try {
      const permitted = await this.voice.requestPermission();
      if (permitted && this.isMounted && panel === this.assistantPanel) this.voice.startListening(true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  private closeAssistantForHostAction(): void {
    // Inline assistance stays available while the user interacts with the host.
    this.guide.clear();
  }

  private renderAssistantUI(): void {
    if (this.assistantPanel) return;

    const panel = document.createElement('aside');
    panel.id = 'roha-assistant-panel';
    panel.className = 'roha-aside';
    panel.setAttribute('data-roha-ignore', 'true');
    panel.setAttribute('data-roha-assistant', 'true');
    
    panel.lang = this.locale === 'am' ? 'am' : 'en';
    panel.setAttribute('aria-label', rc('roha.title', this.locale));
    if (!document.querySelector('link[data-roha-styles]')) {
      const sheet = document.createElement('link');
      sheet.rel = 'stylesheet'; sheet.href = stylesheetURL;
      sheet.setAttribute('data-roha-styles', ''); document.head.appendChild(sheet);
    }
    const text = (key: Parameters<typeof rc>[0]) => rc(key, this.locale);
    panel.innerHTML = `
      <div id="roha-full-card" class="roha-card">
        <div class="roha-header">
          <h2 class="roha-title">${text('roha.title')}</h2>
        </div>
        <p>${text('roha.inlineIntro')}</p>
        <div class="roha-grid">
          <button id="roha-launcher-pill" class="roha-pill" type="button">${text('roha.open')}</button>
          <button id="roha-btn-stop" type="button">${text('roha.stop')}</button>
        </div>
        <span id="roha-voice-status-badge" class="roha-badge">${text('roha.ready')}</span>
        <div id="roha-live-region" class="roha-live-sr" role="status" aria-live="polite" aria-atomic="true"></div>
        <p id="roha-transcript" class="roha-transcript">${text('roha.intro')}</p>
        <div class="roha-pending" data-roha-pending hidden>
          <strong>${text('roha.pendingTitle')}</strong>
          <p data-roha-preview></p>
          <div class="roha-grid">
            <button type="button" data-roha-confirm>${text('roha.confirm')}</button>
            <button type="button" data-roha-cancel>${text('roha.correct')}</button>
          </div>
        </div>
        <div class="roha-grid">
          <button type="button" data-roha-guide>${text('roha.guide')}</button>
          <button type="button" data-roha-forward>${text('roha.forward')}</button>
          <button type="button" data-roha-back>${text('roha.backward')}</button>
          <button id="roha-btn-check-answer" type="button">${text('roha.review')}</button>
        </div>
        <form class="roha-command-form">
          <label for="roha-command">${text('roha.request')}</label>
          <input id="roha-command" name="request" type="text" maxlength="1000" autocomplete="off" />
          <button class="roha-btn-primary-blue" type="submit">${text('roha.send')}</button>
        </form>
        <p class="roha-hint">${text('roha.guideHint')}</p>
        <button type="button" data-ai-options>${text('roha.aiOptions')}</button>
        <p data-ai-description></p>
        <label data-ai-consent-label hidden><input type="checkbox" data-ai-consent> ${text('roha.aiConsent')}</label>
        <p class="roha-voice-notice">${text('roha.voiceNotice')}</p>
        <div class="roha-grid">
          <button id="roha-btn-mic" type="button">${text('roha.voice')}</button>
          <button id="roha-btn-stuck" type="button">${text('roha.stuck')}</button>
          <button id="roha-btn-bigger" type="button">${text('roha.bigger')}</button>
          <button id="roha-btn-simple" type="button">${text('roha.simple')}</button>
          <button id="roha-btn-contrast" type="button">${text('roha.contrast')}</button>
          <button id="roha-btn-read" type="button">${text('roha.read')}</button>
        </div>
        <button id="roha-btn-reset" type="button">${text('roha.reset')}</button>
      </div>`;
    // IDs must be unique when more than one component is installed.
    for (const element of Array.from(panel.querySelectorAll('[id]'))) {
      const original = element.id;
      element.setAttribute('data-roha-control', original);
      element.id = `${original}-${this.instanceId}`;
    }
    for (const element of Array.from(panel.querySelectorAll('[for], [aria-controls]'))) {
      for (const attr of ['for', 'aria-controls']) {
        const value = element.getAttribute(attr);
        if (value) element.setAttribute(attr, `${value}-${this.instanceId}`);
      }
    }
    panel.id = `roha-assistant-panel-${this.instanceId}`;
    document.body.appendChild(panel);
    if (document.querySelector('body > #root')) document.body.classList.add('roha-layout');
    this.assistantPanel = panel;
    this.liveRegion = panel.querySelector('[data-roha-control="roha-live-region"]');
    const pill = panel.querySelector('[data-roha-control="roha-launcher-pill"]') as HTMLButtonElement;
    const command = panel.querySelector<HTMLInputElement>('[data-roha-control="roha-command"]')!;
    pill.addEventListener('click', () => { command.focus(); void this.enableVoice(); });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        this.requestVersion++; this.guide.reset(); this.readExecutor.stop(); this.voice.stopListening();
        this.announce(text('roha.stopped')); pill.focus();
      }
    });
    panel.querySelector('[data-roha-guide]')!.addEventListener('click', () => { this.rescan(); this.guide.start(); });
    panel.querySelector('[data-roha-forward]')!.addEventListener('click', () => { this.rescan(); this.guide.forward(); });
    panel.querySelector('[data-roha-back]')!.addEventListener('click', () => this.guide.back());
    panel.querySelector('[data-roha-confirm]')!.addEventListener('click', () => { void this.guide.confirm(); command.focus(); });
    panel.querySelector('[data-roha-cancel]')!.addEventListener('click', () => { this.guide.cancel(); command.focus(); });
    panel.querySelector('form')!.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!command.value.trim()) { command.focus(); return; }
      const value = command.value; command.value = '';
      void this.handleUserUtterance(value);
      if (!panel.querySelector<HTMLElement>('[data-roha-pending]')!.hidden) {
        panel.querySelector<HTMLButtonElement>('[data-roha-confirm]')!.focus();
      }
    });
    const consent = panel.querySelector<HTMLInputElement>('[data-ai-consent]')!;
    let serverProvider: ServerLLMProvider | null = null;
    panel.querySelector<HTMLButtonElement>('[data-ai-options]')!.onclick = async () => {
      const version = ++this.requestVersion;
      consent.checked = false;
      consent.disabled = true;
      serverProvider?.consent(false);
      const provider = new ServerLLMProvider(this.aiEndpoint);
      try {
        const config = await provider.describe();
        if (version !== this.requestVersion) return;
        const providerNames: Record<string, string> = { openai: 'OpenAI', gemini: 'Google Gemini', anthropic: 'Anthropic Claude', ollama: 'Ollama', custom: text('roha.aiCustom') };
        panel.querySelector('[data-ai-description]')!.textContent = config.provider === 'disabled' ? text('roha.aiDisabled') : rc('roha.aiSelected', this.locale, { provider: providerNames[config.provider] || text('roha.aiCustom'), model: config.model });
        panel.querySelector<HTMLElement>('[data-ai-consent-label]')!.hidden = config.provider === 'disabled';
        serverProvider = provider; this.setLLMProvider(provider);
        consent.disabled = false;
      } catch { this.announce(text('roha.notUnderstood')); }
    };
    consent.onchange = () => { this.requestVersion++; serverProvider?.consent(consent.checked); };

    // Attach button event listeners
    panel.querySelector('[data-roha-control="roha-btn-mic"]')?.addEventListener('click', () => {
      void this.enableVoice();
    });

    panel.querySelector('[data-roha-control="roha-btn-stop"]')?.addEventListener('click', () => {
      this.guide.reset();
      this.readExecutor.stop();
      this.voice.stopListening();
      this.requestVersion++;
      this.announce(rc('roha.stopped', this.locale));
    });

    panel.querySelector('[data-roha-control="roha-btn-stuck"]')?.addEventListener('click', () => {
      this.rescan(); this.guide.start();
    });

    panel.querySelector('[data-roha-control="roha-btn-check-answer"]')?.addEventListener('click', () => {
      this.handleUserUtterance('Check my answers');
    });

    panel.querySelector('[data-roha-control="roha-btn-bigger"]')?.addEventListener('click', () => {
      const nextScale = Math.min(200, this.textScale.getPercent() + 25);
      this.executeIntent({
        schemaVersion: '2.0',
        utteranceId: 'ui-click',
        mapId: this.currentMap?.mapId || 'ui',
        mapVersion: this.currentMap?.mapVersion || 1,
        intent: 'text_scale',
        targetId: 'page.main',
        payload: { percent: nextScale as 100 | 125 | 150 | 175 | 200 },
      });
    });

    panel.querySelector('[data-roha-control="roha-btn-simple"]')?.addEventListener('click', () => {
      const newState = !this.simpleMode.isEnabled();
      this.executeIntent({
        schemaVersion: '2.0',
        utteranceId: 'ui-click',
        mapId: this.currentMap?.mapId || 'ui',
        mapVersion: this.currentMap?.mapVersion || 1,
        intent: 'simple_mode',
        targetId: 'page.main',
        payload: { enabled: newState },
      });
    });

    panel.querySelector('[data-roha-control="roha-btn-contrast"]')?.addEventListener('click', () => {
      const newTheme = this.contrast.getTheme() === 'default' ? 'high-contrast' : 'default';
      this.executeIntent({
        schemaVersion: '2.0',
        utteranceId: 'ui-click',
        mapId: this.currentMap?.mapId || 'ui',
        mapVersion: this.currentMap?.mapVersion || 1,
        intent: 'contrast',
        targetId: 'page.main',
        payload: { theme: newTheme },
      });
    });

    panel.querySelector('[data-roha-control="roha-btn-read"]')?.addEventListener('click', () => {
      this.executeIntent({
        schemaVersion: '2.0',
        utteranceId: 'ui-click',
        mapId: this.currentMap?.mapId || 'ui',
        mapVersion: this.currentMap?.mapVersion || 1,
        intent: 'read',
        targetId: 'page.main',
        payload: {},
      });
    });

    panel.querySelector('[data-roha-control="roha-btn-reset"]')?.addEventListener('click', () => {
      this.executeIntent({
        schemaVersion: '2.0',
        utteranceId: 'ui-click',
        mapId: this.currentMap?.mapId || 'ui',
        mapVersion: this.currentMap?.mapVersion || 1,
        intent: 'reset_preferences',
        targetId: 'page.main',
        payload: {},
      });
    });
  }

  private updateVoiceStatusUI(state: VoiceState, msg?: string): void {
    if (!this.assistantPanel) return;
    if (msg) {
      this.updateTranscriptUI(msg, true);
    }
    const badge = this.assistantPanel.querySelector('[data-roha-control="roha-voice-status-badge"]') as HTMLElement;
    if (!badge) return;

    const labels: Record<VoiceState, Parameters<typeof rc>[0]> = {
      unpermitted: 'roha.voiceUnpermitted', ready: 'roha.ready', listening: 'roha.listening',
      processing: 'roha.processing', speaking: 'roha.speaking', paused: 'roha.paused', error: 'roha.voiceError',
    };
    badge.textContent = rc(labels[state], this.locale);
    badge.className = 'roha-badge';
    if (state === 'listening') {
      badge.classList.add('roha-badge-listening');
    } else if (state === 'speaking') {
      badge.classList.add('roha-badge-speaking');
    } else if (state === 'error' || state === 'unpermitted') {
      badge.classList.add('roha-badge-error');
    }
  }

  private updateTranscriptUI(text: string, _isFinal: boolean): void {
    if (!this.assistantPanel) return;
    const transcriptEl = this.assistantPanel.querySelector('[data-roha-control="roha-transcript"]') as HTMLElement;
    if (transcriptEl) {
      transcriptEl.textContent = text;
    }
  }
}

// Global browser window export for drop-in <script src="roha.js">
if (typeof window !== 'undefined') {
  const roha = new RohaSDK();
  (window as any).Roha = roha;
  (window as any).RohaSDK = RohaSDK;
  (window as any).createLLMProvider = createLLMProvider;
  (window as any).OpenAILLMProvider = OpenAILLMProvider;
  (window as any).GeminiLLMProvider = GeminiLLMProvider;
  (window as any).AnthropicLLMProvider = AnthropicLLMProvider;
  (window as any).OllamaLLMProvider = OllamaLLMProvider;
  (window as any).ChromeBuiltInAIProvider = ChromeBuiltInAIProvider;
  (window as any).GenericRESTProvider = GenericRESTProvider;
  (window as any).MockLLMProvider = MockLLMProvider;

  const initAutoMount = () => {
    const currentScript = bundleScript || document.querySelector('script[src*="roha.js"]');
    const rootSelector = currentScript?.getAttribute('data-roha-root') || '#op-main, #main, main, [role="main"]';
    const autoMount = currentScript ? currentScript.getAttribute('data-roha-auto') !== 'false' : true;

    if (autoMount && !document.querySelector('roha-agent, roha-assistant')) {
      const declaredLanguage = currentScript?.getAttribute('data-roha-language');
      const language = declaredLanguage === 'en' || declaredLanguage === 'am' ? declaredLanguage : undefined;
      const endpoint = currentScript?.getAttribute('data-roha-api');
      if (endpoint) roha.configureAPI({ provider: 'server', endpoint });
      let mounted = false;
      const tryMount = () => {
        if (mounted) return;
        let rootEl: HTMLElement | null;
        try { rootEl = document.querySelector(rootSelector); } catch { return; }
        if (rootEl && (rootEl.children.length > 0 || document.readyState === 'complete')) {
          mounted = true;
          roha.mount({ root: rootEl, language });
        }
      };

      tryMount();
      if (!mounted) {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          tryMount();
          if (mounted || attempts >= 20) {
            clearInterval(interval);
          }
        }, 100);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoMount);
  } else {
    // Run after tick so DOM is ready if script is inline
    setTimeout(initAutoMount, 0);
  }
}

// Module re-exports
export * from './element';
export * from './integrations';
export * from './providers/llm-provider';
export * from './types';
export * from './registry';
export * from './discovery';
export * from './validator';
export * from './router';
export * from './voice';
export * from './conversation';
export * from './drafts';
export * from './runtime-profile';
