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
import { spokenToDigits } from '../digits';
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
  private lastStepKey: string = '';
  private stepReadTimer: ReturnType<typeof setTimeout> | null = null;

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
            this.handleUserUtterance(transcript, true);
          }
        },
        onError: (err: string) => {
          this.announce(err);
        },
        onInterrupted: () => {
          // User started speaking while Roha is talking — stop her immediately
          this.readExecutor.stop();
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
        this.autoReadStep(600);
      },
    });
    this.observer.observe(this.rootElement);

    // 3. Render Roha Assistant Panel
    this.renderAssistantUI();

    // Stop speaking if the user clicks an option or button while Roha is talking
    this.rootElement?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (this.readExecutor.getSpeakingState() && target && target.closest('button, input, label, a, .op-choice')) {
        this.readExecutor.stop();
      }
    });

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

  public executeIntent(proposal: RohaIntent, suppressAnnounce = false): { success: boolean; error?: string } {
    const validation = this.validator.validate(proposal);
    if (!validation.valid) {
      const err = `Intent validation rejected: ${validation.errors.join('; ')}`;
      this.announce(rc('roha.actionUnavailable', this.locale));
      return { success: false, error: err };
    }

    switch (proposal.intent) {
      case 'chat':
        return { success: true };

      case 'text_scale':
        this.textScale.apply(proposal.payload.percent);
        if (!suppressAnnounce) this.announce(rc('roha.textScaled', this.locale, { percent: proposal.payload.percent }));
        return { success: true };

      case 'simple_mode':
        this.simpleMode.apply(proposal.payload.enabled, this.rootElement || document.body, this.locale === 'am' ? 'am' : 'en');
        if (!suppressAnnounce) this.announce(rc(proposal.payload.enabled ? 'roha.simpleOn' : 'roha.simpleOff', this.locale));
        return { success: true };

      case 'contrast':
        this.contrast.applyContrast(proposal.payload.theme);
        if (!suppressAnnounce) this.announce(rc(proposal.payload.theme === 'high-contrast' ? 'roha.contrastOn' : 'roha.contrastOff', this.locale));
        return { success: true };

      case 'reduced_motion':
        this.contrast.applyReducedMotion(proposal.payload.enabled);
        if (!suppressAnnounce) this.announce(rc(proposal.payload.enabled ? 'roha.motionOn' : 'roha.motionOff', this.locale));
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
          if (!suppressAnnounce) this.announce(rc('roha.movedBack', this.locale));
        } else if (proposal.payload?.direction === 'forward') {
          const err = this.getVisibleFormError();
          if (err) {
            this.speakAndFocusError(err);
            return { success: false, error: err };
          }
          this.advanceToNextStep();
        } else {
          const focused = this.formAction.focusTarget(proposal.targetId);
          return focused ? { success: true } : { success: false, error: 'Target could not receive focus' };
        }
        return { success: true };

      case 'filter':
        this.formAction.filterItems(proposal.targetId, proposal.payload.query);
        if (!suppressAnnounce) this.announce(rc('roha.filtered', this.locale, { query: proposal.payload.query }));
        return { success: true };

      case 'propose_answer': {
        const val = proposal.payload?.value;
        if (val) {
          const handledOption = this.handleSelectOptionIntent(val);
          if (handledOption) return { success: true };

          const textInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            '#op-main input.op-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), #op-main textarea.op-input, #op-main input:not([type="checkbox"]):not([type="radio"]):not([type="file"])'
          );
          if (textInput && textInput.offsetParent !== null) {
            return { success: this.fillTextInput(textInput, val) };
          }
        }
        return { success: this.guide.propose(proposal.targetId, proposal.payload.value) };
      }

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
        if (!suppressAnnounce) this.announce(rc('roha.paused', this.locale));
        return { success: true };

      case 'resume':
        const recap = this.conversation.getResumeRecap();
        this.readExecutor.speak(recap, this.locale);
        return { success: true };

      case 'undo':
        this.textScale.undo();
        this.conversation.undoLastAnswer();
        if (!suppressAnnounce) this.announce(rc('roha.undone', this.locale));
        return { success: true };

      case 'reset_preferences':
        this.textScale.reset();
        this.contrast.reset();
        this.simpleMode.apply(false, this.rootElement || document.body);
        if (!suppressAnnounce) this.announce(rc('roha.resetDone', this.locale));
        return { success: true };

      default:
        return { success: false, error: 'Unhandled intent execution' };
    }
  }

  public async handleUserUtterance(utterance: string, useProvider = true): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.rescan();
    this.readExecutor.unlock();

    // Direct Voice & Command Actions (Option select, Next, Back, Read, Scale, High Contrast, Dictation)
    if (this.tryDirectVoiceAction(utterance)) return;

    if (this.guide.command(utterance)) return;
    if (/^(?:answer\s*:?\s+|my name is\s+|ስሜ\s+)/iu.test(utterance) && this.guide.answer(utterance)) return;
    // A field answer is accepted only after the user starts guided filling.
    // Extract real-time screen context from the active page
    const currentHeading = document.querySelector('#op-main h1, main h1, h1, [role="heading"][aria-level="1"]')?.textContent?.trim() || '';
    const currentDesc = document.querySelector('.op-step-desc, .op-desc, #op-main p:not([hidden]):not([aria-hidden="true"])')?.textContent?.trim() || '';
    const currentChoices = Array.from(document.querySelectorAll<HTMLElement>('.op-choice, label, input[type="radio"], input[type="checkbox"]'))
      .filter(el => el.offsetParent !== null && !el.closest('[data-roha-ignore], [data-roha-assistant], aside'))
      .map(el => el.textContent?.trim() || (el as HTMLInputElement).value || '')
      .filter(t => t && !t.includes('🔊') && t !== currentHeading && t !== currentDesc);

    const visibleError = this.getVisibleFormError();

    const context = {
      activeTargetId: undefined,
      currentTextScalePercent: this.textScale.getPercent(),
      locale: this.locale,
      screenContext: {
        activeQuestion: currentHeading,
        description: currentDesc,
        options: Array.from(new Set(currentChoices)).slice(0, 10),
        hasError: Boolean(visibleError),
        errorMessage: visibleError || '',
      },
    };

    const llm = this.router.getLLMProvider();
    const hasAi = useProvider && llm && (llm instanceof ServerLLMProvider ? llm.hasConsent() : true);

    if (hasAi && this.currentMap) {
      try {
        this.updateTranscriptUI(this.locale === 'am' ? 'ሮሃ እያሰበች ነው...' : 'Roha is thinking...', false);
        const llmIntent = await llm.interpret(utterance, this.currentMap, context);
        if (requestVersion !== this.requestVersion) return;
        if (llmIntent) {
          const aiMessage = (llmIntent as any).message || (llmIntent.payload as any)?.message;
          if (aiMessage) {
            this.announce(aiMessage);
            this.readExecutor.speak(aiMessage, this.locale);
          }
          if (llmIntent.intent && (llmIntent.intent as string) !== 'chat') {
            this.executeIntent(llmIntent, Boolean(aiMessage));
          }
          // After Roha replies, restart listening so the user can speak next (smooth loop)
          if (this.voice.getState() !== 'unpermitted') {
            setTimeout(() => {
              if (!this.readExecutor.getSpeakingState()) {
                this.voice.startListening(true, false);
              }
            }, 400);
          }
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

    // 1. Synchronous deterministic local route (0ms latency fallback)
    const localIntent = this.router.route(utterance, context);
    if (localIntent) {
      this.executeIntent(localIntent);
      return;
    }

    if (this.guide.answer(utterance)) return;

    if (requestVersion !== this.requestVersion) return;
    this.announce(rc('roha.notUnderstood', this.locale));
  }

  public announce(message: string): void {
    this.updateTranscriptUI(message, true);
    if (this.liveRegion) {
      this.liveRegion.textContent = message;
    }
  }

  /** Build a brief 1–2 sentence summary of the current step for auto-reading. */
  private buildStepSummary(mode: 'normal' | 'simple' = 'normal'): string {
    const h1 = document.querySelector('#op-main h1, main h1, h1')?.textContent?.trim() || '';
    const desc = document.querySelector('.op-step-desc, .op-desc, #op-main p:not([hidden]):not([aria-hidden="true"])')?.textContent?.trim() || '';
    const choiceEls = Array.from(document.querySelectorAll<HTMLElement>(
      '#op-main .op-options label, #op-main label.op-option, #op-main label.op-check, #op-main .op-choice'
    )).filter(el => el.offsetParent !== null && !el.closest('[data-roha-ignore],[data-roha-assistant]'));
    const choices = Array.from(new Set(
      choiceEls.map(el => el.textContent?.trim() || '').filter(t => t && !t.includes('🔊'))
    )).slice(0, 5);

    const isAm = this.locale === 'am';
    const textInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      '#op-main input.op-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), #op-main textarea.op-input'
    );
    const fileInput = document.querySelector<HTMLInputElement>('#op-main input[type="file"], input[type="file"]');
    const hasFilePreview = document.querySelector('.op-file-preview') !== null;

    if (mode === 'simple') {
      const question = h1 || desc;
      if (!question) return '';
      if (choices.length > 0) {
        return isAm
          ? `ትኩረት ያድርጉ። ጥያቄው፡ "${question}" ነው። አማራጮቹ፡ ${choices.join('፣ ')} ናቸው። ከእነዚህ አንዱን ይምረጡ።`
          : `Listen carefully. The question is: "${question}". Choices are: ${choices.join(', ')}. Please choose one.`;
      }
      if (fileInput) {
        if (hasFilePreview) {
          return isAm
            ? 'ፎቶ ተመርጧል። ለመቀጠል «ቀጣይ» ይበሉ፣ ወይም ለመቀየር «ፎቶ አንሳ» ይበሉ።'
            : 'Photo selected. Say "Next" to continue, or "Take photo" to replace it.';
        }
        return isAm
          ? `የመታወቂያ ወይም የሰነድ ፎቶ ያስፈልጋል። ፎቶ ለማንሳት «ፎቶ አንሳ» ወይም «ፋይል ምረጥ» ይበሉ።`
          : `ID or document photo needed. Say "Take photo" or "Upload file" to choose.`;
      }
      if (textInput) {
        return isAm
          ? `ትኩረት ያድርጉ። ጥያቄው፡ "${question}" ነው። መልስዎን በድምጽ ይንገሩኝ።`
          : `Listen carefully. The question is: "${question}". You can tell me your answer by speaking.`;
      }
      return isAm
        ? `ጥያቄው፡ "${question}" ነው። ቀላሉን እንከተል።`
        : `The question is: "${question}". Let me know if you need help.`;
    }

    const parts: string[] = [];
    if (h1) parts.push(h1);
    if (desc && desc !== h1 && desc.length < 180) parts.push(desc);
    if (choices.length > 0) {
      parts.push(isAm ? `አማራጮቹ፡ ${choices.join('፣ ')}።` : `Options: ${choices.join(', ')}.`);
    } else if (fileInput) {
      if (hasFilePreview) {
        parts.push(isAm ? 'ሰነድ ወይም ፎቶ ተመርጧል። ለመቀጠል «ቀጣይ» ይበሉ።' : 'Document photo selected. Say "Next" to continue.');
      } else {
        parts.push(isAm ? 'ፎቶ ለማንሳት ወይም ሰነድ ለመስቀል «ፎቶ አንሳ» ወይም «ፋይል ምረጥ» ይበሉ።' : 'To take a photo or upload, say "Take photo" or "Upload file".');
      }
    } else if (textInput) {
      parts.push(isAm ? 'መልስዎን በድምጽ መናገር ወይም መጻፍ ይችላሉ።' : 'You can speak or type your answer.');
    }
    return parts.join(isAm ? '። ' : '. ');
  }

  /** Auto-read the current step briefly when the heading changes (new step). */
  private autoReadStep(delay = 600): void {
    const voiceState = this.voice.getState();
    // Only auto-read when voice is active
    if (!['listening', 'processing', 'ready', 'speaking'].includes(voiceState)) return;
    const key = document.querySelector('#op-main h1, main h1, h1')?.textContent?.trim() || '';
    if (!key || key === this.lastStepKey) return;
    this.lastStepKey = key;
    if (this.stepReadTimer) { clearTimeout(this.stepReadTimer); this.stepReadTimer = null; }
    this.stepReadTimer = setTimeout(() => {
      this.stepReadTimer = null;
      if (this.readExecutor.getSpeakingState()) return;
      const summary = this.buildStepSummary('normal');
      if (summary) {
        this.readExecutor.unlock();
        this.readExecutor.speak(summary, this.locale);
        this.announce(summary);
      }
    }, delay);
  }

  public getVisibleFormError(): string | null {
    // 1. Check top error summary banner
    const summaryItem = document.querySelector<HTMLElement>('.op-error-summary li, .op-error-summary a');
    if (summaryItem?.textContent?.trim()) {
      return summaryItem.textContent.trim().replace(/^[•\s]+/, '');
    }
    // 2. Check inline field error
    const fieldErrors = document.querySelectorAll<HTMLElement>('.op-error, [role="alert"]:not([data-roha-assistant] *), .op-field-error');
    for (const err of Array.from(fieldErrors)) {
      if (err.closest('[data-roha-ignore], [data-roha-assistant], aside')) continue;
      const txt = err.textContent?.trim();
      if (txt) return txt.replace(/^[⚠•\s]+/, '');
    }
    return null;
  }

  public speakAndFocusError(errorMsg: string): void {
    const isAm = this.locale === 'am';
    const cleanErr = errorMsg.replace(/^[⚠•\s]+/, '').trim();
    const alertMsg = isAm
      ? `ስህተት ተከስቷል፦ ${cleanErr}። እባክዎ አስተካክለው እንደገና ይሞክሩ።`
      : `There is an error: ${cleanErr}. Please correct it before continuing.`;
    this.announce(alertMsg);
    this.readExecutor.speak(alertMsg, this.locale);

    const target = document.querySelector<HTMLElement>('[aria-invalid="true"], .op-input:invalid, .op-error-summary a');
    if (target) {
      if (target instanceof HTMLAnchorElement && target.hash) {
        const linked = document.querySelector<HTMLElement>(target.hash);
        if (linked) {
          try { linked.focus(); linked.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
        }
      } else {
        try { target.focus(); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
      }
    }
  }

  private advanceToNextStep(): void {
    const currentStepHeading = document.querySelector('#op-main h1, main h1, h1')?.textContent?.trim() || '';
    const nextBtn = document.querySelector<HTMLButtonElement>(
      '#op-main button[type="submit"].op-btn-primary, button.op-btn-primary, #op-main button[type="submit"], button[type="submit"]'
    );
    const form = document.querySelector<HTMLFormElement>('#op-main form, form');

    if (nextBtn) {
      try { nextBtn.focus(); } catch {}
      try { nextBtn.click(); } catch {}
    } else if (form) {
      try {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      } catch {}
    }

    setTimeout(() => {
      const errorAfter = this.getVisibleFormError();
      const newStepHeading = document.querySelector('#op-main h1, main h1, h1')?.textContent?.trim() || '';

      if (errorAfter && newStepHeading === currentStepHeading) {
        this.speakAndFocusError(errorAfter);
        return;
      }

      if (newStepHeading !== currentStepHeading) {
        const isAm = this.locale === 'am';
        const msg = isAm ? 'ወደ ቀጣዩ ደረጃ እየሄድን ነው።' : 'Moving to the next step.';
        this.announce(msg);
        this.rescan();
        this.autoReadStep(400);
      }
    }, 250);
  }

  private selectOptionAndAdvance(targetLabel: HTMLElement, input: HTMLInputElement, fallbackText = ''): boolean {
    const isAm = this.locale === 'am';
    const isLangStep = input.name === 'language' ||
      document.querySelector('main[data-step-type="language"]') !== null ||
      input.value === 'am' || input.value === 'en';

    if (isLangStep) {
      const targetLang = input.value || 'am';
      const topLangBtn = document.querySelector<HTMLButtonElement>(`.op-lang button[lang="${targetLang}"]`);
      if (topLangBtn) { try { topLangBtn.click(); } catch {} }
    }

    if (input.type === 'checkbox') {
      if (!input.checked) {
        targetLabel.click();
        if (!input.checked) {
          input.click();
        }
      }
    } else {
      try {
        const proto = window.HTMLInputElement.prototype;
        const setChecked = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
        if ((input as any)._valueTracker) (input as any)._valueTracker.setValue('');
        if (setChecked) {
          setChecked.call(input, false);
          setChecked.call(input, true);
        } else input.checked = true;
      } catch {}

      try { targetLabel.click(); } catch {}
      try { input.click(); } catch {}
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const labelSpan = targetLabel.querySelector('.op-option-label') || targetLabel;
    const rawText = (labelSpan.textContent || targetLabel.textContent || '').trim();
    // Only strip single leading bullet markers like "1. ", "A) ", "ሀ. ", etc.
    const cleanChosen = rawText.replace(/^[A-Za-z0-9ሀ-ፐ]\s*[\.\)፦\-:]\s*/u, '').trim() || fallbackText || input.value;
    // For spoken announcements, shorten parenthetical text: e.g. "ሰነድ የለኝም (በአጋር ድርጅት በኩል እገዛ እፈልጋለሁ)" -> "ሰነድ የለኝም"
    const spokenChosen = cleanChosen.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || cleanChosen;
    const isConsent = input.type === 'checkbox' && (input.value === 'agree-share' || targetLabel.classList.contains('op-check') || cleanChosen.includes('ተስማምቻለሁ') || cleanChosen.includes('ይሰጥ'));
    const msg = isConsent
      ? (isAm ? 'ስምምነትዎ ተረጋግጧል።' : 'Consent confirmed.')
      : (isAm ? `«${spokenChosen}» ተመርጧል።` : `"${spokenChosen}" selected.`);

    this.announce(msg);
    this.readExecutor.speak(msg, this.locale);

    setTimeout(() => {
      this.advanceToNextStep();
    }, 600);
    return true;
  }

  private handleSelectOptionIntent(query: string): boolean {
    const optionLabels = Array.from(document.querySelectorAll<HTMLElement>(
      '#op-main .op-options label, #op-main label.op-option, #op-main label.op-check, #op-main .op-choice'
    ));
    if (optionLabels.length === 0) return false;
    const clean = query.trim().toLowerCase();

    if (/^(?:this|current|here|ይህ|ይሄ)$/i.test(clean)) {
      const checkedLabel = optionLabels.find(l => l.querySelector<HTMLInputElement>('input')?.checked) || optionLabels[0];
      const inp = checkedLabel?.querySelector<HTMLInputElement>('input');
      if (checkedLabel && inp) return this.selectOptionAndAdvance(checkedLabel, inp);
    }

    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 1 && num <= optionLabels.length) {
      const target = optionLabels[num - 1];
      const inp = target.querySelector<HTMLInputElement>('input');
      if (inp) return this.selectOptionAndAdvance(target, inp);
    }

    // Specific check for refer / no document / partner help
    if (/(?:ሰነድ\s*(?:የለኝም|የለም)|የለኝም|የለም|የብለይን|hin\s*qabu|አጋር|እገዛ|እርዳታ|በአጋር|ድርጅት|እፈልጋለሁ|tumsa|refer|partner|no\s*id|no\s*document|don'?t\s*have)/iu.test(clean)) {
      const referLabel = optionLabels.find(l => {
        const inp = l.querySelector<HTMLInputElement>('input');
        return inp?.value === 'refer' || /የለኝም|አጋር|እገዛ|refer|partner/i.test(l.textContent || '');
      });
      if (referLabel) {
        const inp = referLabel.querySelector<HTMLInputElement>('input');
        if (inp) return this.selectOptionAndAdvance(referLabel, inp);
      }
    }

    // Specific check for consent / agree-share
    if (/(?:ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|ስምምነት|ስምምነቴን|ይሰጥ|agree|consent)/iu.test(clean)) {
      const agreeLabel = optionLabels.find(l => {
        const inp = l.querySelector<HTMLInputElement>('input');
        return inp?.value === 'agree-share' || /ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|agree|consent/i.test(l.textContent || '');
      });
      if (agreeLabel) {
        const inp = agreeLabel.querySelector<HTMLInputElement>('input');
        if (inp) return this.selectOptionAndAdvance(agreeLabel, inp);
      }
    }

    for (const label of optionLabels) {
      const inp = label.querySelector<HTMLInputElement>('input');
      if (!inp) continue;
      const labelText = label.textContent?.toLowerCase() || '';
      if (inp.value.toLowerCase() === clean || labelText.includes(clean) || clean.includes(inp.value.toLowerCase())) {
        return this.selectOptionAndAdvance(label, inp);
      }
    }
    return false;
  }

  private fillTextInput(textInput: HTMLInputElement | HTMLTextAreaElement, val: string): boolean {
    const isAm = this.locale === 'am';
    const isPhone = textInput.type === 'tel' ||
      textInput.name === 'phone' ||
      textInput.id === 'phone' ||
      textInput.getAttribute('inputmode') === 'tel' ||
      /ስልክ|phone|bilbila/i.test(document.querySelector('#op-main h1, main h1, h1')?.textContent || '');

    let finalVal = val;
    let isPhoneIncomplete = false;

    if (isPhone) {
      // 1. Convert spoken words to digits
      let digits = spokenToDigits(val, (this.locale as any) || 'am').replace(/[^\d+]/g, '');

      // 2. If user already had partial digits in the input and is speaking continuation
      const currentDigits = textInput.value.replace(/[^\d+]/g, '');
      if (currentDigits && digits && !digits.startsWith('0') && !digits.startsWith('+251')) {
        digits = currentDigits + digits;
      }

      // 3. Normalize Ethiopian 9-digit format (912345678 -> 0912345678)
      if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) {
        digits = '0' + digits;
      }

      finalVal = digits;

      // 4. Check if all digits are told (Ethiopian format: 10 digits starting with 09 or 07, or +251...)
      const isComplete = /^(?:0[79]\d{8}|\+251[79]\d{8}|251[79]\d{8})$/.test(digits);
      if (!isComplete) {
        isPhoneIncomplete = true;
      }
    }

    try {
      if ((textInput as any)._valueTracker) {
        (textInput as any)._valueTracker.setValue('');
      }
      const proto = textInput instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(textInput, finalVal);
      } else {
        textInput.value = finalVal;
      }
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      textInput.dispatchEvent(new Event('change', { bubbles: true }));
      textInput.focus();
    } catch {}

    let msg: string;
    if (isPhone && isPhoneIncomplete) {
      msg = isAm
        ? `«${finalVal}» የተሟላ ስልክ ቁጥር አይደለም። ስልክ ቁጥር 10 አሃዝ መሆን አለበት (ለምሳሌ፦ 0912345678)። እባክዎ የቀሩትን አሃዞች ይንገሩኝ።`
        : `"${finalVal}" is incomplete. Ethiopian phone numbers must have 10 digits (e.g. 0912345678). Please tell me the rest of the digits.`;
    } else if (isPhone) {
      msg = isAm
        ? `ስልክ ቁጥር «${finalVal}» ተሞልቷል። ትክክል ከሆነ «ቀጣይ» ይበሉ ወይም ያርሙት።`
        : `Phone number "${finalVal}" is complete. If correct, say "Next" to continue.`;
    } else {
      msg = isAm
        ? `«${finalVal}» ተሞልቷል። ትክክል ከሆነ «ቀጣይ» ይበሉ ወይም ያርሙት።`
        : `Entered "${finalVal}". If correct, say "Next" to continue.`;
    }

    this.announce(msg);
    this.readExecutor.speak(msg, this.locale);

    if (this.voice.getState() !== 'unpermitted') {
      setTimeout(() => {
        if (!this.readExecutor.getSpeakingState()) {
          this.voice.startListening(true, false);
        }
      }, 500);
    }
    return true;
  }

  private tryDirectVoiceAction(utterance: string): boolean {
    const raw = utterance.trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();
    const isAm = this.locale === 'am' || /[\u1200-\u137F]/.test(raw);

    // 0. Consent & Agreement for statement/consent screens (e.g. referral agreement to share name/phone)
    const isConsentPhrase = /(?:ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|ስምምነት|ስምምነቴን|ይሰጥ|አዎ\s*(?:ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|ይሰጥ)?|እሺ\s*(?:ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|ይሰጥ)?|i\s*agree|agree|i\s*consent|consent|yes\s*(?:i\s*agree)?|walii\s*nan\s*gala|walii\s*galeera|ተሰማሚዐ)/iu.test(lower) ||
      (/(?:^|\s|[፣፤፥።፡,.\?!])(?:አዎ|እሺ|yes|ok|okay|eyyee|እወ)(?:$|\s|[፣፤፥።፡,.\?!])/iu.test(lower) && Boolean(document.querySelector('#op-main label.op-check input[type="checkbox"], #op-main input[type="checkbox"]')));

    if (isConsentPhrase) {
      const consentLabel = document.querySelector<HTMLElement>('#op-main label.op-check, #op-main .op-options label');
      const consentCheckbox = consentLabel?.querySelector<HTMLInputElement>('input[type="checkbox"]') ||
        document.querySelector<HTMLInputElement>('#op-main input[type="checkbox"]');
      if (consentCheckbox && consentLabel) {
        return this.selectOptionAndAdvance(consentLabel, consentCheckbox, isAm ? 'ስምምነት' : 'Consent');
      }
    }

    // 0b. Refusal / Decline on consent screens
    if (/(?:አልስማማም|አልፈልግም|አይሆንም|አልፈቅድም|disagree|decline|don'?t\s*agree)/iu.test(lower)) {
      const consentCheckbox = document.querySelector<HTMLInputElement>('#op-main label.op-check input[type="checkbox"], #op-main input[type="checkbox"]');
      if (consentCheckbox) {
        const msg = isAm
          ? 'ስምምነት ካልሰጡ ወደ ኋላ ተመልሰን ሌላ አማራጭ መምረጥ እንችላለን። ወደ ኋላ እየተመለስን ነው።'
          : 'If you do not agree, we can go back and choose another option. Going back.';
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        const backBtn = document.querySelector<HTMLButtonElement>('#op-main button.op-btn-back, button.op-btn-back');
        if (backBtn) setTimeout(() => backBtn.click(), 400);
        return true;
      }
    }

    // 1. Next step / Proceed
    if (/^(?:ቀጣይ|ቀጥል|ወደፊት|ሂድ|next|continue|forward|proceed)/iu.test(lower) ||
        /(?:ቀጣይ\s*ደረጃ|next\s*step|ቀጣዩ|ቀጣይ)/iu.test(lower)) {
      this.advanceToNextStep();
      return true;
    }

    // 1b. Stop / silence / pause
    if (/^(?:አቁም|ዝም|ዝም\s*በይ|ዝም\s*በል|ቆይ|stop|pause|quiet|be\s*quiet|silence)\b/iu.test(lower)) {
      this.readExecutor.stop();
      const msg = isAm ? 'ዝም ብያለሁ።' : 'Stopping.';
      this.announce(msg);
      return true;
    }

    // 2. Previous step / Back
    if (/^(?:ተመለስ|ወደ\s*ኋላ|ቀዳሚ|back|previous|go\s*back)\b/iu.test(lower) ||
        /(?:ያለፈው\s*ደረጃ|previous\s*step)/iu.test(lower)) {
      const backBtn = document.querySelector<HTMLButtonElement>('#op-main button.op-btn-back, button.op-btn-back, button[aria-label*="Back"], button[aria-label*="ተመለስ"]');
      if (backBtn) {
        const msg = isAm ? 'ወደ ቀደመው ደረጃ ተመልሰናል።' : 'Going back to the previous step.';
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        setTimeout(() => backBtn.click(), 300);
        return true;
      }
    }

    // 3. Read aloud
    if (/^(?:አንብብ|አንብቢ|አንብቢልኝ|ስማ|read|speak|listen)\b/iu.test(lower)) {
      const msg = isAm ? 'ጥያቄውን ላንብብልዎት።' : 'Reading the question aloud.';
      this.announce(msg);
      this.readExecutor.readTarget('page.main', this.locale);
      return true;
    }

    // 3b. Simple/child-friendly explanation
    if (/(?:ቀላል|ቀጥተኛ|ቀላሉን|አብራራ|ቀላል\s*ቃል|like\s*a\s*kid|simply|simple|explain\s*simply|easy\s*words|ቀላል\s*አብራራ)/iu.test(lower)) {
      this.simpleMode.apply(true, this.rootElement || document.body, this.locale === 'am' ? 'am' : 'en');
      const hostSimpleBtn = document.querySelector<HTMLButtonElement>('.op-toggles button[aria-pressed]');
      if (hostSimpleBtn && hostSimpleBtn.getAttribute('aria-pressed') !== 'true') {
        try { hostSimpleBtn.click(); } catch {}
      }
      const summary = this.buildStepSummary('simple');
      if (summary) {
        this.announce(summary);
        this.readExecutor.speak(summary, this.locale);
      }
      return true;
    }

    // 4. Text scale enlarge
    if (/(?:ትልቅ\s*ጽሑፍ|ጽሑፉን\s*አተልቅ|ጽሑፍ\s*አተልቅ|make\s*text\s*bigger|bigger\s*text|zoom)/iu.test(lower)) {
      const nextScale = this.textScale.getPercent() >= 150 ? 100 : 150;
      this.textScale.apply(nextScale as 100 | 150);
      const msg = isAm ? 'የጽሑፉ መጠን እንዲተልቅ ተደርጓል።' : 'Text size has been increased.';
      this.announce(msg);
      this.readExecutor.speak(msg, this.locale);
      return true;
    }

    // 5. High contrast
    if (/(?:ከፍተኛ\s*ንፅፅር|ንፅፅር|high\s*contrast|dark\s*mode)/iu.test(lower)) {
      const nextTheme = this.contrast.getTheme() === 'high-contrast' ? 'default' : 'high-contrast';
      this.contrast.applyContrast(nextTheme);
      const msg = isAm ? 'የቀለም ንፅፅር ተቀይሯል።' : 'Contrast mode toggled.';
      this.announce(msg);
      this.readExecutor.speak(msg, this.locale);
      return true;
    }

    // 6. Matching and selecting options on the active screen
    const optionLabels = Array.from(document.querySelectorAll<HTMLElement>(
      '#op-main .op-options label, #op-main label.op-option, #op-main label.op-check, #op-main .op-choice'
    ));

    // Clean conversational prefixes & fillers
    const cleanUtt = lower
      .replace(/^(?:i\s+said\s+|i\s+say\s+|i\s+would\s+say\s+)/iu, '')
      .replace(/^(?:i\s+want\s+to\s+|i\s+want\s+|i\s+prefer\s+to\s+|i\s+prefer\s+|i\s+choose\s+|i\s+select\s+|i\s+pick\s+|i\s+take\s+)/iu, '')
      .replace(/^(?:please\s+|let\s+me\s+choose\s+|let\s+me\s+select\s+|choose\s+|select\s+|pick\s+|take\s+)/iu, '')
      .replace(/^(?:the\s+)?(?:option\s+)?/iu, '')
      .replace(/^(?:እኔ\s+)?(?:የምመርጠው\s+|የምፈልገው\s+|እመርጣለሁ\s+|እፈልጋለሁ\s+)?/iu, '')
      .replace(/^(?:እባክሽን\s+|እባክህ\s+|እባክዎ\s+|እባክዎት\s+)?(?:ይምረጡ\s+|ይምረጡልኝ\s+|ምረጥ\s+|ምረጪ\s+|አድርግ\s+|አድርጊ\s+|አድርግልኝ\s+)?/iu, '')
      .replace(/(?:የሚለውን|የሚለውን\s+አማራጭ|እመርጣለሁ|እፈልጋለሁ|ነው\s+የምመርጠው|ነው\s+የምፈልገው)$/iu, '')
      .trim();

    // 6a. "This option" / "This one" / "ይህን" / "ይሄን"
    const isThis = /^(?:this\s*(?:one|option)?|that\s*(?:one|option)?|here|ይህ(?:ን|ንን)?|ይሄ(?:ን|ንን)?|ይኸው|ይህንኑ)$/iu.test(cleanUtt) ||
      /(?:i\s+choose\s+this|i\s+pick\s+this|choose\s+this|select\s+this|ይህን\s*ምረጥ|ይሄን\s*ምረጥ)/iu.test(lower);
    if (isThis && optionLabels.length > 0) {
      const checkedLabel = optionLabels.find(l => {
        const inp = l.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
        return inp?.checked;
      }) || optionLabels[0];
      const inp = checkedLabel?.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
      if (checkedLabel && inp) {
        return this.selectOptionAndAdvance(checkedLabel, inp, isAm ? 'ይህ አማራጭ' : 'This option');
      }
    }

    // 6b. Ordinal & Letter selection: first, second, A, B, 1, 2, etc.
    const isFirst = /(?:የመጀመሪያ|አንደኛ|first|1st|^1$|^a$|^ሀ$|^አ$)/iu.test(cleanUtt) || /(?:option\s*(?:1|a)|አማራጭ\s*(?:1|አ|ሀ))/iu.test(lower);
    const isSecond = /(?:ሁለተኛ|second|2nd|^2$|^b$|^ለ$)/iu.test(cleanUtt) || /(?:option\s*(?:2|b)|አማራጭ\s*(?:2|ለ))/iu.test(lower);
    const isThird = /(?:ሶስተኛ|ሦስተኛ|third|3rd|^3$|^c$|^ሐ$)/iu.test(cleanUtt) || /(?:option\s*(?:3|c)|አማራጭ\s*(?:3|ሐ))/iu.test(lower);
    const isFourth = /(?:አራተኛ|fourth|4th|^4$|^d$|^መ$)/iu.test(cleanUtt) || /(?:option\s*(?:4|d)|አማራጭ\s*(?:4|መ))/iu.test(lower);
    const isFifth = /(?:አምስተኛ|fifth|5th|^5$|^e$|^ሠ$|^ረ$)/iu.test(cleanUtt) || /(?:option\s*(?:5|e)|አማራጭ\s*(?:5|ሠ|ረ))/iu.test(lower);
    const isLast = /(?:የመጨረሻ|last)\b/iu.test(cleanUtt);

    if (optionLabels.length > 0 && (isFirst || isSecond || isThird || isFourth || isFifth || isLast)) {
      const idx = isFirst ? 0 : isSecond ? 1 : isThird ? 2 : isFourth ? 3 : isFifth ? 4 : optionLabels.length - 1;
      const targetLabel = optionLabels[idx];
      if (targetLabel) {
        const input = targetLabel.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
        if (input) {
          return this.selectOptionAndAdvance(targetLabel, input);
        }
      }
    }

    // 6b-2. Priority check for Option 5 (refer / no ID / partner assistance)
    if (/(?:ሰነድ|መታወቂያ|ፎቶ)\s*(?:የለኝም|የለም)|የለኝም|የለም|የብለይን|hin\s*qabu|አጋር|እገዛ|እርዳታ|በአጋር|ድርጅት|እፈልጋለሁ|tumsa|refer|partner|no\s*id|no\s*document|don'?t\s*have/iu.test(lower)) {
      const referLabel = optionLabels.find(l => {
        const inp = l.querySelector<HTMLInputElement>('input');
        return inp?.value === 'refer' || /የለኝም|አጋር|እገዛ|refer|partner/i.test(l.textContent || '');
      });
      if (referLabel) {
        const inp = referLabel.querySelector<HTMLInputElement>('input');
        if (inp) return this.selectOptionAndAdvance(referLabel, inp);
      }
    }

    // 6c. Matching label text, keywords, and values
    for (const label of optionLabels) {
      const labelText = label.textContent?.trim().toLowerCase() || '';
      const input = label.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
      if (!input || !labelText) continue;

      const val = input.value.toLowerCase();
      const valMatch = Boolean(val && val.length >= 2 && lower.includes(val));

      // Clean label text: remove punctuation and whitespace
      const cleanLabel = labelText.replace(/[\(\)\[\],.፣፤፥።፡/\\-]/g, ' ').replace(/\s+/g, ' ').trim();
      const directMatch = cleanUtt.length >= 2 && (cleanLabel.includes(cleanUtt) || cleanUtt.includes(cleanLabel));

      // Specific semantic recognition for Step 5 options
      const isFayda = (val === 'fayda' || cleanLabel.includes('ፋይዳ')) && /ፋይዳ|fayda/iu.test(lower);
      const isKebele = (val === 'kebele' || cleanLabel.includes('ቀበሌ')) && /ቀበሌ|kebele/iu.test(lower);
      const isRefugee = (val === 'refugee' || cleanLabel.includes('ስደተኛ')) && /ስደተኛ|refugee/iu.test(lower);
      const isOther = (val === 'other' || cleanLabel.includes('ሌላ')) && /ሌላ|other|another|ፓስፖርት|መንጃ/iu.test(lower) && !/(?:የለኝም|አጋር|እገዛ)/iu.test(lower);
      const isRefer = (val === 'refer' || cleanLabel.includes('አጋር') || cleanLabel.includes('የለኝም')) &&
        /(?:የለኝም|አጋር|እገዛ|እርዳታ|በአጋር|ድርጅት|እፈልጋለሁ|refer|partner|no\s*id|no\s*document|don'?t\s*have)/iu.test(lower);
      const isAgree = (val === 'agree-share' || cleanLabel.includes('ተስማምቻለሁ') || cleanLabel.includes('ይሰጥ')) &&
        /(?:ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|ስምምነት|ስምምነቴን|ይሰጥ|agree|consent)/iu.test(lower);

      const isAmharicOption = /አማርኛ|amharic/i.test(labelText) || val === 'am';
      const isEnglishOption = /english|እንግሊዝኛ/i.test(labelText) || val === 'en';
      const mentionsAmharic = /አማርኛ|amharic/i.test(lower);
      const mentionsEnglish = /english|እንግሊዝኛ/i.test(lower);

      // Extract significant words and strip Amharic prefixes (e.g. የፋይዳ -> ፋይዳ, የቀበሌ -> ቀበሌ)
      // Ignore common stop words like ሰነድ and መታወቂያ that occur in all ID options
      const stopWords = ['option', 'አማራጭ', 'label', 'ሰነድ', 'የሰነድ', 'መታወቂያ', 'የመታወቂያ', 'document', 'id'];
      const words = cleanLabel.split(/\s+/).filter(w => w.length >= 3 && !stopWords.includes(w));
      const wordMatch = words.some(w => {
        const root = w.replace(/^[የበለከወ]/, '');
        return lower.includes(w) || (root.length >= 3 && !stopWords.includes(root) && lower.includes(root));
      });

      if (directMatch || valMatch || isAgree || isRefer || isFayda || isKebele || isRefugee || isOther ||
          wordMatch || (isAmharicOption && mentionsAmharic) || (isEnglishOption && mentionsEnglish)) {
        return this.selectOptionAndAdvance(label, input);
      }
    }

    // 6d. File upload & Photo camera trigger (Step 6)
    const fileInput = document.querySelector<HTMLInputElement>('#op-main input[type="file"], input[type="file"]');
    if (fileInput && fileInput.offsetParent !== null) {
      if (/(?:ፎቶ|ካሜራ|ስቀል|ፋይል|ምረጥ|መታወቂያ|ሰነድ|photo|camera|upload|file|choose|take)/iu.test(lower) &&
          !/(?:የለኝም|የለም|don'?t|no)/iu.test(lower)) {
        const msg = isAm
          ? 'የካሜራ ወይም የፋይል መምረጫው ተከፍቷል። ፎቶ ያንሱ ወይም ሰነድ ይምረጡ።'
          : 'File and camera picker opened. Please take a photo or select your document.';
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        fileInput.focus();
        fileInput.click();
        return true;
      }

      if (/(?:ሰነድ|መታወቂያ|ፎቶ)\s*(?:የለኝም|የለም)|የለኝም|no\s*document|no\s*id|don'?t\s*have/iu.test(lower)) {
        const msg = isAm
          ? 'ሰነድ ከሌለዎት ወደ ኋላ ተመልሰን የአጋር ድርጅት እገዛ መምረጥ እንችላለን። ወደ ኋላ እየተመለስን ነው።'
          : 'If you do not have a document, we can go back and choose partner help. Going back.';
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        const backBtn = document.querySelector<HTMLButtonElement>('#op-main button.op-btn-back, button.op-btn-back');
        if (backBtn) setTimeout(() => backBtn.click(), 400);
        return true;
      }
    }

    // 7. Dictating answers into active text inputs
    const textInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      '#op-main input.op-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), #op-main textarea.op-input, #op-main input:not([type="checkbox"]):not([type="radio"]):not([type="file"])'
    );
    if (textInput && textInput.offsetParent !== null) {
      const isExplicitDictation = /^(?:ስሜ\s+|my\s*name\s*is\s+|መልስ\s*:?\s*|ይህ\s*ነው\s*|ስም\s*:?\s*|ቁጥሬ\s*|ቁጥሬ\s*ነው\s*|ስልኬ\s*)/iu.test(raw);
      const cleanVal = raw
        .replace(/^(?:my\s*name\s*is\s+|i\s*am\s+|call\s*me\s+|it\s*is\s+|answer\s*:?\s*|ስሜ\s+|ስሜ\s*የሚባለው\s+|የምባለው\s+|መልስ\s*:?\s*|ይህ\s*ነው\s*|ስም\s*:?\s*|ቁጥሬ\s*|ቁጥሬ\s*ነው\s*|የስልክ\s*ቁጥሬ\s*)/iu, '')
        .replace(/(?:\s+ነው|\s+ናቸው|\s+ይባላል)$/iu, '')
        .trim();

      // Accept if explicitly phrased, or if on a text-only input screen (no choices) and utterance has at least 1 char
      if (cleanVal && (isExplicitDictation || (optionLabels.length === 0 && cleanVal.length >= 1))) {
        return this.fillTextInput(textInput, cleanVal);
      }
    }

    return false;
  }

  private async enableVoice(): Promise<void> {
    const panel = this.assistantPanel;
    const button = panel?.querySelector<HTMLButtonElement>('[data-roha-control="roha-btn-mic"]');
    if (button) button.disabled = true;
    this.readExecutor.stop();
    try {
      const permitted = await this.voice.requestPermission();
      if (permitted && this.isMounted && panel === this.assistantPanel) {
        this.voice.startListening(true);
        this.autoReadStep(400);
      }
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
    panel.addEventListener('pointerdown', () => this.readExecutor.unlock());
    panel.addEventListener('click', () => this.readExecutor.unlock());
    command.addEventListener('keydown', () => this.readExecutor.unlock());
    panel.querySelector('form')!.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!command.value.trim()) { command.focus(); return; }
      const value = command.value; command.value = '';
      this.readExecutor.unlock();
      void this.handleUserUtterance(value);
      if (!panel.querySelector<HTMLElement>('[data-roha-pending]')!.hidden) {
        panel.querySelector<HTMLButtonElement>('[data-roha-confirm]')!.focus();
      }
    });
    const consent = panel.querySelector<HTMLInputElement>('[data-ai-consent]')!;
    let serverProvider: ServerLLMProvider | null = null;
    const initProvider = async (autoConsent = false) => {
      const version = ++this.requestVersion;
      if (!autoConsent) {
        consent.checked = false;
        consent.disabled = true;
        serverProvider?.consent(false);
      }
      const provider = new ServerLLMProvider(this.aiEndpoint);
      try {
        const config = await provider.describe();
        if (version !== this.requestVersion) return;
        const providerNames: Record<string, string> = { openai: 'OpenAI', gemini: 'Google Gemini', anthropic: 'Anthropic Claude', ollama: 'Ollama', custom: text('roha.aiCustom') };
        panel.querySelector('[data-ai-description]')!.textContent = config.provider === 'disabled' ? text('roha.aiDisabled') : rc('roha.aiSelected', this.locale, { provider: providerNames[config.provider] || text('roha.aiCustom'), model: config.model });
        panel.querySelector<HTMLElement>('[data-ai-consent-label]')!.hidden = config.provider === 'disabled';
        serverProvider = provider; this.setLLMProvider(provider);
        consent.disabled = false;
        if (autoConsent && config.provider !== 'disabled') {
          consent.checked = true;
          provider.consent(true);
        }
      } catch {
        if (!autoConsent) this.announce(text('roha.notUnderstood'));
      }
    };
    panel.querySelector<HTMLButtonElement>('[data-ai-options]')!.onclick = () => void initProvider(false);
    consent.onchange = () => { this.requestVersion++; serverProvider?.consent(consent.checked); };
    void initProvider(true);

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
      this.readExecutor.unlock();
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
