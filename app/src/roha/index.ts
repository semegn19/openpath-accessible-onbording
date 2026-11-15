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
  WebSpeechWakeDetector,
  WAKE_WORD_REGEX,
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

export function spokenToEmail(raw: string): string {
  let s = raw.trim();

  // 1. Strip leading conversational phrases
  s = s.replace(/^(?:my\s+email\s+is|email\s+is|my\s+email|email|it\s+is|it'?s)\s+/iu, '');
  s = s.replace(/^(?:ኢሜይሌ\s*ነው|ኢሜይሌ|ኢሜይል|የኔ\s*ኢሜይል)\s*/iu, '');
  s = s.replace(/^(?:imeeliin\s*koo|imeelii)\s*/iu, '');
  s = s.replace(/^(?:ኢሜይለይ\s*እዩ|ኢሜይለይ|ኢሜይል)\s*/iu, '');
  s = s.replace(/^(?:iimeelkaygu\s*waa|iimaylkaygu|iimayl)\s*/iu, '');

  // 2. Strip trailing conversational endings
  s = s.replace(/\s+(?:ነው|እዩ|waa|dha|jedhama)$/iu, '');

  // 3. Convert spoken '@':
  // " at ", " [at] ", " (at) ", " @ ", " አት ", " ኣት "
  s = s.replace(/\s+(?:\[at\]|\(at\)|at|አት|ኣት)\s+/giu, '@');
  s = s.replace(/(?:^|\s)at\s+/giu, '@');
  s = s.replace(/\s+at(?=[a-zA-Z0-9])/giu, '@');

  // 4. Convert spoken dots:
  // " dot ", " period ", " point ", " ዶት ", " ነጥብ ", " ነጥቢ ", " qabxii ", " bar "
  s = s.replace(/\s*(?:\[dot\]|\(dot\)|dot|period|point|ዶት|ነጥብ|ነጥቢ|qabxii|bar)\s*/giu, '.');

  // 5. Convert common phonetic transliterations for domains
  s = s.replace(/ጂሜይል|ጅሜይል/giu, 'gmail');
  s = s.replace(/ያሁ/giu, 'yahoo');
  s = s.replace(/ሆትሜይል/giu, 'hotmail');
  s = s.replace(/አውትሉክ|ኣውትሉክ/giu, 'outlook');
  s = s.replace(/ኮም/giu, 'com');

  // 6. Convert spoken symbols
  s = s.replace(/\s*(?:underscore|አንደርስኮር|ታች\s*መስመር)\s*/giu, '_');
  s = s.replace(/\s*(?:hyphen|dash|ሰረዝ)\s*/giu, '-');

  // 7. Strip all whitespace inside the email
  s = s.replace(/\s+/g, '');

  // 8. Auto-complete standard domains if missing TLD (e.g. "dog@gmail" -> "dog@gmail.com")
  if (/@([a-zA-Z0-9-]+)$/.test(s)) {
    const domain = s.split('@')[1].toLowerCase();
    if (['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'proton', 'mail'].includes(domain)) {
      s += '.com';
    }
  }

  return s.toLowerCase();
}

export class RohaSDK {
  public spokenToEmail = spokenToEmail;
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
    const defaultWakeDetector = new WebSpeechWakeDetector(this.locale);
    this.wakeWordManager = new PluggableWakeWordManager(defaultWakeDetector);
    this.wakeWordManager.setOnWakeAction(() => {
      this.handleWakeWordActivation();
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
          const detector = this.wakeWordManager.getDetector();
          if (detector && 'evaluateTranscript' in detector) {
            (detector as any).evaluateTranscript(transcript);
          }
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
    const initialDocLang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    const initialLocale: Locale = (initialDocLang === 'am' || initialDocLang === 'ti' || initialDocLang === 'om' || initialDocLang === 'so') ? initialDocLang : 'en';
    this.locale = options.language || initialLocale;
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

    // Configure Wake-Word detector locale
    const wakeDetector = this.wakeWordManager.getDetector();
    if (wakeDetector && 'setLocale' in wakeDetector) {
      (wakeDetector as any).setLocale(this.locale);
    }

    // Unlock audio speech synthesis on first user interaction
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.readExecutor.unlock();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    }
    if (!options.language) {
      this.languageObserver = new MutationObserver(() => {
        const docLang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
        const detected: Locale = (docLang === 'am' || docLang === 'ti' || docLang === 'om' || docLang === 'so') ? docLang : 'en';
        this.setLanguage(detected);
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
    const wakeDetector = this.wakeWordManager.getDetector();
    if (wakeDetector && 'setLocale' in wakeDetector) {
      (wakeDetector as any).setLocale(language);
    }
    const provider = this.router.getLLMProvider();
    if (provider instanceof ServerLLMProvider) provider.consent(false);
    if (!this.isMounted) return;
    this.guide.reset();
    const activeControl = this.assistantPanel?.contains(document.activeElement)
      ? document.activeElement?.getAttribute('data-roha-control') : null;
    const draft = this.assistantPanel?.querySelector<HTMLInputElement>('[data-roha-control="roha-command"]')?.value || '';
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
        if ((proposal.payload as any)?.readReview) {
          const summary = this.buildStepSummary('normal');
          this.announce(summary);
          this.readExecutor.speak(summary, this.locale);
          return { success: true };
        }
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
        if ((proposal.payload as any)?.editStep) {
          const stepKey = String((proposal.payload as any).editStep).toLowerCase();
          const reviewItems = this.getReviewItems();
          const target = reviewItems.find(item =>
            item.question.toLowerCase().includes(stepKey) ||
            (stepKey === 'name' && item.question.includes('ስም')) ||
            (stepKey === 'phone' && item.question.includes('ስልክ')) ||
            (stepKey === 'language' && item.question.includes('ቋንቋ')) ||
            (stepKey === 'id-route' && (item.question.includes('መታወቂያ') || item.question.includes('ማንነት') || item.question.includes('ሰነድ')))
          );
          if (target?.editBtn) {
            target.editBtn.click();
            return { success: true };
          }
        }
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
          if (textInput) {
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

  public handleWakeWordActivation(): void {
    const greeting = this.t({
      en: 'Hello! I can assist you to register the form, just say a word.',
      am: 'ሰላም! ይህንን ቅጽ ለመመዝገብ ልረዳዎት እችላለሁ፡ ዝም ብለው ይናገሩ።',
      om: 'Akkam! Foormii kana galmeessuuf si gargaaruu nan danda\'a, waan barbaaddu dubbadhu.',
      ti: 'ሰላም! ነዚ ፎርም ንምምዝጋብ ክሕግዘኩም እኽእል እየ፡ ቃል ጥራይ ተዛረቡ።',
      so: 'Hayye! Waxaan kaa caawin karaa diiwaangelinta foomkan, kaliya hal eray dheh.',
    });

    this.announce(greeting);
    if (this.assistantPanel) {
      this.assistantPanel.classList.remove('roha-hidden');
    }

    this.readExecutor.speak(greeting, this.locale, () => {
      void this.voice.requestPermission().then((permitted) => {
        if (permitted) {
          this.voice.startListening(true, false);
        }
      });
    });
  }

  public wake(): void {
    this.handleWakeWordActivation();
  }

  public async handleUserUtterance(utterance: string, useProvider = true): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.rescan();
    this.readExecutor.unlock();

    // Wake word direct speech trigger
    if (WAKE_WORD_REGEX.test(utterance.trim())) {
      this.handleWakeWordActivation();
      return;
    }

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
        const thinkingText = this.t({
          am: 'ሮሃ እያሰበች ነው...',
          om: 'Roohaan yaadaa jira...',
          ti: 'ሮሃ ትሓስብ ኣላ...',
          en: 'Roha is thinking...',
        });
        this.updateTranscriptUI(thinkingText, false);
        const llmIntent = await llm.interpret(utterance, this.currentMap, context);
        if (requestVersion !== this.requestVersion) return;
        if (llmIntent) {
          const aiMessage = (llmIntent as any).message || (llmIntent.payload as any)?.message;
          const isForwardNav = llmIntent.intent === 'navigate' && (llmIntent.payload as any)?.direction === 'forward';
          const activeErr = this.getVisibleFormError();
          const mentionsForward = /(?:ወደ ቀጣይ|ቀጣይ ደረጃ|ቀጥል|sadarkaa itti aanu|ቀጻሊ|moving to the next|going to next|እያሄድን|እየሄድን|ce'aa|ንኸይድ)/iu.test(aiMessage || '');

          if ((isForwardNav || mentionsForward) && activeErr) {
            this.speakAndFocusError(activeErr);
            return;
          }

          // Guard: If on phone step and phone is incomplete or invalid, do NOT allow LLM forward navigation or forward message!
          const phoneInput = document.querySelector<HTMLInputElement>(
            '#op-main input[type="tel"], #op-main input[name="phone"], #op-main input#phone, input[type="tel"]'
          );
          if (phoneInput && (isForwardNav || mentionsForward)) {
            const rawPhone = phoneInput.value.trim().replace(/[\s\-()]/g, '');
            const isCompletePhone = /^(?:0[79]\d{8}|\+251[79]\d{8}|251[79]\d{8})$/.test(rawPhone);
            if (!isCompletePhone) {
              const errTxt = rawPhone.length === 0
                ? this.t({
                    am: 'እባክዎ መጀመሪያ ስልክ ቁጥርዎን ያስገቡ። ምሳሌ፦ 0912345678',
                    om: 'Mee jalqaba lakkoofsa bilbila keessanii galchaa. Fakkeenyaaf: 0912345678',
                    ti: 'በጃኹም መጀመርታ ናይ ስልኪ ቍጽርኹም ኣእትዉ። ንኣብነት፦ 0912345678',
                    en: 'Please enter your phone number first. Example: 0912345678',
                  })
                : this.t({
                    am: 'ስልክ ቁጥሩ ትክክል አይመስልም። ምሳሌ፦ 0912345678',
                    om: 'Lakkoofsi bilbilaa sirrii miti. Fakkeenyaaf: 0912345678',
                    ti: 'ናይ ስልኪ ቍጽሪ ትኽክል ኣይኮነን። ንኣብነት፦ 0912345678',
                    en: 'Phone number is invalid. Example: 0912345678',
                  });
              this.speakAndFocusError(errTxt);
              return;
            }
          }

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

  private t(dict: { am: string; om: string; ti: string; en: string; so?: string }): string {
    const l = (this.locale || 'en').toLowerCase().slice(0, 2);
    if (l === 'om') return dict.om;
    if (l === 'ti') return dict.ti;
    if (l === 'so') return dict.so || dict.en;
    if (l === 'am') return dict.am;
    return dict.en;
  }

  public getReviewItems(): Array<{ question: string; answer: string; editBtn: HTMLButtonElement | null }> {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#op-main .op-review-row, dl.op-review div.op-review-row'));
    return rows.map(row => {
      const dt = row.querySelector('dt');
      const dd = row.querySelector('dd');
      const span = dd?.querySelector('span:not(.op-sr)');
      const btn = row.querySelector<HTMLButtonElement>('button.op-btn-link, button');
      return {
        question: dt?.textContent?.trim() || '',
        answer: span?.textContent?.trim() || '',
        editBtn: btn
      };
    }).filter(item => item.question && item.answer);
  }

  /** Build a brief 1–2 sentence summary of the current step for auto-reading. */
  private buildStepSummary(mode: 'normal' | 'simple' = 'normal'): string {
    const reviewItems = this.getReviewItems();
    if (reviewItems.length > 0) {
      const itemSummaries = reviewItems.map(item => `${item.question}፦ «${item.answer}»`).join('፤ ');
      if (mode === 'simple') {
        return this.t({
          am: `የሰጧቸው መልሶች፦ ${itemSummaries}። ለመቀየር «ስም ቀይር» ይበሉ። ትክክል ከሆነ «ቀጥል» ይበሉ።`,
          om: `Deebiiwwan keessan: ${itemSummaries}. Jijjiiruuf "maqaa jijjiiri" jedhaa. Sirrii yoo ta'e "itti fufi" jedhaa.`,
          ti: `ዝሃብኩምዎም መልስታት፦ ${itemSummaries}። ንምቕያር «ስም ቀይር» በሉ። ቅኑዕ እንተኾይኑ «ቀጽል» በሉ።`,
          en: `Your answers: ${itemSummaries}. To change, say "Edit name". If correct, say "Continue".`
        });
      }
      return this.t({
        am: `መረጃዎን ይመልከቱ። የሰጧቸው መልሶች፦ ${itemSummaries}። ማስተካከል የሚፈልጉት ካለ «ስም ቀይር» ወይም «ስልክ አስተካክል» ማለት ይችላሉ። ትክክል ከሆነ «ቀጥል» ይበሉ።`,
        om: `Oodeeffannoo keessan ilaalaa. Deebiiwwan keessan: ${itemSummaries}. Yoo sirreessuu barbaaddan "maqaa jijjiiri" ykn "bilbila jijjiiri" jechuu dandeessu. Sirrii yoo ta'e "itti fufi" jedhaa.`,
        ti: `ሓበሬታኹም ርኣዩ። ዝሃብኩምዎም መልስታት፦ ${itemSummaries}። ከተዐርዩ እንተደሊኹም «ስም ቀይር» ወይ «ስልኪ ቀይር» ክትብሉ ትኽእሉ ኢኹም። ቅኑዕ እንተኾይኑ «ቀጽል» በሉ።`,
        en: `Review your information. Your answers: ${itemSummaries}. To edit, say "Edit name" or "Change phone". If correct, say "Continue".`
      });
    }

    const h1 = document.querySelector('#op-main h1, main h1, h1')?.textContent?.trim() || '';
    const desc = document.querySelector('.op-step-desc, .op-desc, #op-main p:not([hidden]):not([aria-hidden="true"])')?.textContent?.trim() || '';
    const choiceEls = Array.from(document.querySelectorAll<HTMLElement>(
      '#op-main .op-options label, #op-main label.op-option, #op-main label.op-check, #op-main .op-choice'
    )).filter(el => el.offsetParent !== null && !el.closest('[data-roha-ignore],[data-roha-assistant]'));
    const choices = Array.from(new Set(
      choiceEls.map(el => el.textContent?.trim() || '').filter(t => t && !t.includes('🔊'))
    )).slice(0, 5);

    const textInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      '#op-main input.op-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), #op-main textarea.op-input'
    );
    const fileInput = document.querySelector<HTMLInputElement>('#op-main input[type="file"], input[type="file"]');
    const hasFilePreview = document.querySelector('.op-file-preview') !== null;

    if (mode === 'simple') {
      const question = h1 || desc;
      if (!question) return '';
      if (choices.length > 0) {
        return this.t({
          am: `ትኩረት ያድርጉ። ጥያቄው፡ "${question}" ነው። አማራጮቹ፡ ${choices.join('፣ ')} ናቸው። ከእነዚህ አንዱን ይምረጡ።`,
          om: `Xiyyeeffadhaa. Gaaffiin: "${question}" dha. Filannoowwan: ${choices.join(', ')} dha. Mee tokko filadhaa.`,
          ti: `ኣተኵሩ። ሕቶኡ፡ "${question}" እዩ። ኣማራጺታት፡ ${choices.join('፣ ')} እዮም። ሓደ ምረጹ።`,
          en: `Listen carefully. The question is: "${question}". Choices are: ${choices.join(', ')}. Please choose one.`
        });
      }
      if (fileInput) {
        if (hasFilePreview) {
          return this.t({
            am: 'ፎቶ ተመርጧል። ለመቀጠል «ቀጣይ» ይበሉ፣ ወይም ለመቀየር «ፎቶ አንሳ» ይበሉ።',
            om: 'Suuraan filatameera. Itti fufuuf "itti fufi" jedhaa, ykn jijjiiruuf "suuraa kaasi" jedhaa.',
            ti: 'ፎቶ ተመሪጹ ኣሎ። ንምቕጻል «ቀጽል» በሉ፣ ወይ ንምቕያር «ፎቶ ኣልዕል» በሉ።',
            en: 'Photo selected. Say "Next" to continue, or "Take photo" to replace it.'
          });
        }
        return this.t({
          am: `የመታወቂያ ወይም የሰነድ ፎቶ ያስፈልጋል። ፎቶ ለማንሳት «ፎቶ አንሳ» ወይም «ፋይል ምረጥ» ይበሉ።`,
          om: `Suuraan waraqaa eenyummaa ykn sanadaa ni barbaachisa. Suuraa kaasuuf "suuraa kaasi" ykn "faayilii filadhu" jedhaa.`,
          ti: `ናይ መታወቂያ ወይ ሰነድ ፎቶ የድሊ። ፎቶ ንምልዓል «ፎቶ ኣልዕል» ወይ «ፋይል ምረጽ» በሉ።`,
          en: `ID or document photo needed. Say "Take photo" or "Upload file" to choose.`
        });
      }
      if (textInput) {
        return this.t({
          am: `ትኩረት ያድርጉ። ጥያቄው፡ "${question}" ነው። መልስዎን በድምጽ ይንገሩኝ።`,
          om: `Xiyyeeffadhaa. Gaaffiin: "${question}" dha. Deebii keessan sagaleen natti himaa.`,
          ti: `ኣተኵሩ። ሕቶኡ፡ "${question}" እዩ። መልስኹም ብድምጺ ንገሩኒ።`,
          en: `Listen carefully. The question is: "${question}". You can tell me your answer by speaking.`
        });
      }
      return this.t({
        am: `ጥያቄው፡ "${question}" ነው። ቀላሉን እንከተል።`,
        om: `Gaaffiin: "${question}" dha. Salphaatti haa deebisnu.`,
        ti: `ሕቶኡ፡ "${question}" እዩ። ብቐሊሉ ንኺድ።`,
        en: `The question is: "${question}". Let me know if you need help.`
      });
    }

    const parts: string[] = [];
    if (h1) parts.push(h1);
    if (desc && desc !== h1 && desc.length < 180) parts.push(desc);
    if (choices.length > 0) {
      parts.push(this.t({
        am: `አማራጮቹ፡ ${choices.join('፣ ')}።`,
        om: `Filannoowwan: ${choices.join(', ')}.`,
        ti: `ኣማራጺታት፡ ${choices.join('፣ ')}።`,
        en: `Options: ${choices.join(', ')}.`
      }));
    } else if (fileInput) {
      if (hasFilePreview) {
        parts.push(this.t({
          am: 'ሰነድ ወይም ፎቶ ተመርጧል። ለመቀጠል «ቀጣይ» ይበሉ።',
          om: 'Sanadni ykn suuraan filatameera. Itti fufuuf "itti fufi" jedhaa.',
          ti: 'ሰነድ ወይ ፎቶ ተመሪጹ ኣሎ። ንምቕጻል «ቀጽል» በሉ።',
          en: 'Document photo selected. Say "Next" to continue.'
        }));
      } else {
        parts.push(this.t({
          am: 'ፎቶ ለማንሳት ወይም ሰነድ ለመስቀል «ፎቶ አንሳ» ወይም «ፋይል ምረጥ» ይበሉ።',
          om: 'Suuraa kaasuuf ykn sanada olkaa\'uuf "suuraa kaasi" ykn "faayilii filadhu" jedhaa.',
          ti: 'ፎቶ ንምልዓል ወይ ሰነድ ንምስቓል «ፎቶ ኣልዕል» ወይ «ፋይል ምረጽ» በሉ።',
          en: 'To take a photo or upload, say "Take photo" or "Upload file".'
        }));
      }
    } else if (textInput) {
      parts.push(this.t({
        am: 'መልስዎን በድምጽ መናገር ወይም መጻፍ ይችላሉ።',
        om: 'Deebii keessan sagaleen dubbachuu ykn barreessuu dandeessu.',
        ti: 'መልስኹም ብድምጺ ክትዛረቡ ወይ ክትጽሕፉ ትኽእሉ ኢኹም።',
        en: 'You can speak or type your answer.'
      }));
    }
    const sep = (this.locale === 'om' || this.locale === 'en') ? '. ' : '። ';
    return parts.join(sep);
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
    const cleanErr = errorMsg.replace(/^[⚠•\s]+/, '').trim();
    const alertMsg = this.t({
      am: `ስህተት ተከስቷል፦ ${cleanErr}። እባክዎ አስተካክለው እንደገና ይሞክሩ።`,
      om: `Dogoggorri uumameera: ${cleanErr}. Mee sirreessaa irra deebi'aa yaalaa.`,
      ti: `ስሕተት ተረኺቡ ኣሎ፦ ${cleanErr}። በጃኹም ኣዐርዮም ደጊምኩም ፈትኑ።`,
      en: `There is an error: ${cleanErr}. Please correct it before continuing.`,
    });
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
    // 1. If on the phone step, verify the phone number is valid and complete before submitting
    const phoneInput = document.querySelector<HTMLInputElement>(
      '#op-main input[type="tel"], #op-main input[name="phone"], #op-main input#phone, input[type="tel"]'
    );
    if (phoneInput) {
      const rawVal = phoneInput.value.trim().replace(/[\s\-()]/g, '');
      const isCompletePhone = /^(?:0[79]\d{8}|\+251[79]\d{8}|251[79]\d{8})$/.test(rawVal);
      if (!isCompletePhone) {
        const remaining = 10 - (rawVal.startsWith('0') ? rawVal.length : rawVal.length + 1);
        const msg = rawVal.length === 0
          ? this.t({
              am: 'እባክዎ መጀመሪያ ስልክ ቁጥርዎን ያስገቡ። ምሳሌ፦ 0912345678',
              om: 'Mee jalqaba lakkoofsa bilbila keessanii galchaa. Fakkeenyaaf: 0912345678',
              ti: 'በጃኹም መጀመርታ ናይ ስልኪ ቍጽርኹም ኣእትዉ። ንኣብነት፦ 0912345678',
              en: 'Please enter your phone number first. Example: 0912345678',
            })
          : (rawVal.length < 10 && (rawVal.startsWith('09') || rawVal.startsWith('07') || rawVal.startsWith('9') || rawVal.startsWith('7')))
            ? this.t({
                am: `«${rawVal}» አልተሟላም። ${remaining} አሃዝ ይቀራል (ጠቅላላ 10 አሃዝ መሆን አለበት)። እባክዎ የቀሩትን አሃዞች ይንገሩኝ።`,
                om: `"${rawVal}" hin guutamne. Dijitiin ${remaining} hafeera (walumaagalatti dijitii 10). Mee dijitoota hafan natti himaa.`,
                ti: `«${rawVal}» ኣይተማልአን። ${remaining} ኣሃዛት ተሪፎም ኣለዉ (ብጠቕላላ 10 ኣሃዛት)። በጃኹም ዝተረፉ ኣሃዛት ንገሩኒ።`,
                en: `"${rawVal}" is incomplete. ${remaining} digits remaining (10 digits total). Please tell me the rest of the digits.`,
              })
            : this.t({
                am: `«${rawVal}» ትክክለኛ የኢትዮጵያ ስልክ ቁጥር አይደለም። ስልክ ቁጥር በ09 ወይም 07 መጀመር እና 10 አሃዝ መሆን አለበት (ምሳሌ፦ 0912345678)።`,
                om: `"${rawVal}" lakkoofsa bilbilaa Itoophiyaa sirrii miti. Lakkoofsi bilbilaa 09 ykn 07n jalqabuu fi dijitii 10 qabaachuu qaba (fakkeenyaaf 0912345678).`,
                ti: `«${rawVal}» ቅኑዕ ናይ ስልኪ ቍጽሪ ኣይኮነን። ናይ ስልኪ ቍጽሪ ብ09 ወይ 07 ክጅምርን 10 ኣሃዛት ክህልዎን ኣለዎ (ንኣብነት፦ 0912345678)።`,
                en: `"${rawVal}" is not a valid Ethiopian phone number. Ethiopian phone numbers must start with 09 or 07 and have 10 digits (e.g. 0912345678).`,
              });
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        try { phoneInput.focus(); } catch {}
        return;
      }
    }

    // 2. If on a statement / consent step with an unchecked required checkbox, alert user
    const isConsentScreen = document.querySelector('main[data-step-type="statement"], main[data-step-type="submit"], #op-main[data-step-type="statement"], #op-main[data-step-type="submit"]') !== null;
    const requiredCheckboxes = isConsentScreen ? Array.from(document.querySelectorAll<HTMLInputElement>(
      '#op-main label.op-check input[type="checkbox"], #op-main input[type="checkbox"]'
    )).filter(cb => !cb.checked) : [];
    if (requiredCheckboxes.length > 0) {
      const msg = this.t({
        am: 'እባክዎ ከመቀጠልዎ በፊት ስምምነትዎን ያረጋግጡ ወይም «ተስማምቻለሁ» ይበሉ።',
        om: 'Mee utuu hin ceyin dura waliigaltee keessan mirkaneessaa ykn "walii nan gala" jedhaa.',
        ti: 'በጃኹም ቅድሚ ምቕጻልኩም ስምምዕነትኩም ኣረጋግጹ ወይ «ተሰማሚዐ» በሉ።',
        en: 'Please confirm your consent or say "I agree" before proceeding.',
      });
      this.announce(msg);
      this.readExecutor.speak(msg, this.locale);
      try { requiredCheckboxes[0].focus(); } catch {}
      return;
    }

    // 3. If an input on the current step has aria-invalid="true" and hasn't been corrected, announce it
    const invalidCurrentInput = document.querySelector<HTMLElement>('#op-main [aria-invalid="true"]');
    if (invalidCurrentInput && !phoneInput && requiredCheckboxes.length === 0) {
      const existingError = this.getVisibleFormError();
      if (existingError) {
        this.speakAndFocusError(existingError);
        return;
      }
    }
    if (requiredCheckboxes.length > 0) {
      const msg = this.t({
        am: 'እባክዎ ከመቀጠልዎ በፊት ስምምነትዎን ያረጋግጡ ወይም «ተስማምቻለሁ» ይበሉ።',
        om: 'Mee utuu hin ceyin dura waliigaltee keessan mirkaneessaa ykn "walii nan gala" jedhaa.',
        ti: 'በጃኹም ቅድሚ ምቕጻልኩም ስምምዕነትኩም ኣረጋግጹ ወይ «ተሰማሚዐ» በሉ።',
        en: 'Please confirm your consent or say "I agree" before proceeding.',
      });
      this.announce(msg);
      this.readExecutor.speak(msg, this.locale);
      try { requiredCheckboxes[0].focus(); } catch {}
      return;
    }

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
        const msg = this.t({
          am: 'ወደ ቀጣዩ ደረጃ እየሄድን ነው።',
          om: 'Gara sadarkaa itti aanuutti ce\'aa jirra.',
          ti: 'ናብ ቀጻሊ ደረጃ ንኸይድ ኣለና።',
          en: 'Moving to the next step.',
        });
        this.announce(msg);
        this.rescan();
        this.autoReadStep(400);
      }
    }, 250);
  }

  private selectOptionAndAdvance(targetLabel: HTMLElement, input: HTMLInputElement, fallbackText = ''): boolean {
    const isLangStep = input.name === 'language' ||
      document.querySelector('main[data-step-type="language"]') !== null ||
      input.value === 'am' || input.value === 'en' || input.value === 'om' || input.value === 'ti' || input.value === 'so';

    if (isLangStep) {
      const targetLang = input.value || 'am';
      const topLangBtn = document.querySelector<HTMLButtonElement>(`.op-lang button[lang="${targetLang}"]`);
      if (topLangBtn) { try { topLangBtn.click(); } catch {} }
    }

    if (!input.checked) {
      try {
        input.click();
      } catch {}
      if (!input.checked) {
        try { targetLabel.click(); } catch {}
      }
      if (!input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    const labelSpan = targetLabel.querySelector('.op-option-label') || targetLabel;
    const rawText = (labelSpan.textContent || targetLabel.textContent || '').trim();
    // Only strip single leading bullet markers like "1. ", "A) ", "ሀ. ", etc.
    const cleanChosen = rawText.replace(/^[A-Za-z0-9ሀ-ፐ]\s*[\.\)፦\-:]\s*/u, '').trim() || fallbackText || input.value;
    // For spoken announcements, shorten parenthetical text: e.g. "ሰነድ የለኝም (በአጋር ድርጅት በኩል እገዛ እፈልጋለሁ)" -> "ሰነድ የለኝም"
    const spokenChosen = cleanChosen.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || cleanChosen;
    const isConsent = input.type === 'checkbox' && (
      input.value === 'agree-share' ||
      targetLabel.classList.contains('op-check') ||
      cleanChosen.includes('ተስማምቻለሁ') || cleanChosen.includes('ይሰጥ') ||
      cleanChosen.includes('walii') || cleanChosen.includes('ተሰማሚዐ')
    );
    const msg = isConsent
      ? this.t({
          am: 'ስምምነትዎ ተረጋግጧል።',
          om: 'Waliigalteen keessan mirkanaa\'eera.',
          ti: 'ስምምዕነትኩም ተረጋጊጹ ኣሎ።',
          en: 'Consent confirmed.',
        })
      : this.t({
          am: `«${spokenChosen}» ተመርጧል።`,
          om: `"${spokenChosen}" filatameera.`,
          ti: `«${spokenChosen}» ተመሪጹ ኣሎ።`,
          en: `"${spokenChosen}" selected.`,
        });

    this.announce(msg);
    this.readExecutor.speak(msg, this.locale);

    setTimeout(() => {
      this.advanceToNextStep();
    }, 600);
    return true;
  }

  private handleSelectOptionIntent(query: string): boolean {
    if (this.handleJobsFilterVoiceAction(query)) return true;
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
    const isEmail = textInput.type === 'email' ||
      textInput.name === 'email' ||
      textInput.name === 'job-email' ||
      textInput.id === 'email' ||
      textInput.id === 'job-email' ||
      textInput.getAttribute('inputmode') === 'email' ||
      /email|ኢሜይል|iimeelii|iimayl/i.test(document.querySelector('#op-main h1, main h1, h1, #op-main legend, label[for="' + textInput.id + '"]')?.textContent || '');

    const isPhone = !isEmail && (textInput.type === 'tel' ||
      textInput.name === 'phone' ||
      textInput.id === 'phone' ||
      textInput.getAttribute('inputmode') === 'tel' ||
      /ስልክ|phone|bilbila/i.test(document.querySelector('#op-main h1, main h1, h1')?.textContent || ''));

    let finalVal = val;
    let isPhoneIncomplete = false;

    if (isEmail) {
      finalVal = spokenToEmail(val);
    } else if (isPhone) {
      // 1. Convert spoken words to digits
      let digits = spokenToDigits(val, (this.locale as any) || 'am').replace(/[^\d+]/g, '');

      // 2. If user already had partial digits in the input and is speaking continuation
      const currentDigits = textInput.value.replace(/[^\d+]/g, '');
      if (currentDigits && digits && !digits.startsWith('0') && !digits.startsWith('+251')) {
        if (!digits.startsWith(currentDigits) && currentDigits.length + digits.length <= 10) {
          digits = currentDigits + digits;
        }
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
    if (isEmail) {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalVal);
      if (!isValid) {
        msg = this.t({
          am: `የተሞላው ኢሜይል «${finalVal}» አልተሟላም። እባክዎ እንደ «name@gmail.com» ያለ ሙሉ ኢሜይል ይንገሩኝ።`,
          om: `Imeeliin "${finalVal}" sirrii hin fakkaatu. Mee imeelii guutuu akka "name@gmail.com" natti himaa.`,
          ti: `ዝተመሊአ ኢሜይል «${finalVal}» ቅኑዕ ኣይመስልን። በጃኹም ከም «name@gmail.com» ዝበለ ምሉእ ኢሜይል ንገሩኒ።`,
          so: `Iimaylka "${finalVal}" uma eka mid sax ah. Fadlan ii sheeg iimayl buuxa sida "name@gmail.com".`,
          en: `Entered email "${finalVal}" appears incomplete. Please provide a full address like "name@gmail.com".`,
        });
      } else {
        msg = this.t({
          am: `ኢሜይል «${finalVal}» ተሞልቷል። ትክክል ከሆነ «ቀጣይ» ይበሉ ወይም ያርሙት።`,
          om: `Imeeliin "${finalVal}" guutameera. Sirrii yoo ta'e "itti fufi" jedhaa ykn sirreessaa.`,
          ti: `ኢሜይል «${finalVal}» ተመሊኡ ኣሎ። ቅኑዕ እንተኾይኑ «ቀጽል» በሉ ወይ ኣዐርይዎ።`,
          so: `Iimaylka "${finalVal}" waa la galiyay. Haddaad ku qanacsan tahay dheh "Next" ama sax.`,
          en: `Email "${finalVal}" entered. If correct, say "Next" to continue.`,
        });
      }
    } else if (isPhone && isPhoneIncomplete) {
      const isPartialValid = (finalVal.startsWith('09') || finalVal.startsWith('07') || finalVal.startsWith('9') || finalVal.startsWith('7') || finalVal.startsWith('+251')) && finalVal.length < 10;
      const remaining = 10 - (finalVal.startsWith('0') ? finalVal.length : finalVal.length + 1);
      if (isPartialValid && remaining > 0) {
        msg = this.t({
          am: `«${finalVal}» አልተሟላም። ${remaining} አሃዝ ይቀራል (ጠቅላላ 10 አሃዝ መሆን አለበት)። እባክዎ የቀሩትን አሃዞች ይንገሩኝ።`,
          om: `"${finalVal}" hin guutamne. Dijitiin ${remaining} hafeera (walumaagalatti dijitii 10). Mee dijitoota hafan natti himaa.`,
          ti: `«${finalVal}» ኣይተማልአን። ${remaining} ኣሃዛት ተሪፎም ኣለዉ (ብጠቕላላ 10 ኣሃዛት)። በጃኹም ዝተረፉ ኣሃዛት ንገሩኒ።`,
          so: `"${finalVal}" ma dhameystirna. Waxaa ka dhiman ${remaining} nambar. Fadlan ii sheeg nambarrada dhiman.`,
          en: `"${finalVal}" is incomplete. ${remaining} digits remaining (10 digits total). Please tell me the rest of the digits.`,
        });
      } else {
        msg = this.t({
          am: `«${finalVal}» ትክክለኛ የኢትዮጵያ ስልክ ቁጥር አይደለም። ስልክ ቁጥር በ09 ወይም 07 መጀመር እና 10 አሃዝ መሆን አለበት (ምሳሌ፦ 0912345678)። እባክዎ ያስተካክሉ።`,
          om: `"${finalVal}" lakkoofsa bilbilaa Itoophiyaa sirrii miti. Lakkoofsi bilbilaa 09 ykn 07n jalqabuu fi dijitii 10 qabaachuu qaba (fakkeenyaaf 0912345678). Mee sirreessaa.`,
          ti: `«${finalVal}» ቅኑዕ ናይ ስልኪ ቍጽሪ ኣይኮነን። ናይ ስልኪ ቍጽሪ ብ09 ወይ 07 ክጅምርን 10 ኣሃዛት ክህልዎን ኣለዎ (ንኣብነት፦ 0912345678)። በጃኹም ኣዐርዩ።`,
          so: `"${finalVal}" ma aha nambar Itoobiya sax ah. Nambarku waa inuu ka bilowdaa 09 ama 07 oo leeyahay 10 nambar.`,
          en: `"${finalVal}" is not a valid Ethiopian phone number. Ethiopian phone numbers must start with 09 or 07 and have 10 digits (e.g. 0912345678). Please correct it.`,
        });
      }
    } else if (isPhone) {
      msg = this.t({
        am: `ስልክ ቁጥር «${finalVal}» ተሞልቷል። ትክክል ከሆነ «ቀጣይ» ይበሉ ወይም ያርሙት።`,
        om: `Lakkoofsi bilbilaa "${finalVal}" guutameera. Sirrii yoo ta'e "itti fufi" jedhaa ykn sirreessaa.`,
        ti: `ናይ ስልኪ ቍጽሪ «${finalVal}» ተመሊኡ ኣሎ። ቅኑዕ እንተኾይኑ «ቀጽል» በሉ ወይ ኣዐርይዎ።`,
        so: `Nambarka taleefanka "${finalVal}" waa la galiyay. Haddaad ku qanacsan tahay dheh "Next" ama sax.`,
        en: `Phone number "${finalVal}" is complete. If correct, say "Next" to continue.`,
      });
    } else {
      msg = this.t({
        am: `«${finalVal}» ተሞልቷል። ትክክል ከሆነ «ቀጣይ» ይበሉ ወይም ያርሙት።`,
        om: `"${finalVal}" galmeeffameera. Sirrii yoo ta'e "itti fufi" jedhaa ykn sirreessaa.`,
        ti: `«${finalVal}» ተመሊኡ ኣሎ። ቅኑዕ እንተኾይኑ «ቀጽል» በሉ ወይ ኣዐርይዎ።`,
        so: `Waxaa la galiyay "${finalVal}". Haddaad ku qanacsan tahay dheh "Next" ama sax.`,
        en: `Entered "${finalVal}". If correct, say "Next" to continue.`,
      });
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

  public readFilteredJobs(customPrefix?: string): void {
    const jobCards = Array.from(document.querySelectorAll<HTMLElement>('.op-job-cards-list .op-job-card'));
    const count = jobCards.length;

    let msg = '';
    if (count === 0) {
      msg = this.t({
        am: 'የተመረጡትን ድጋፎች የሚያሟላ ክፍት የሥራ ቦታ አልተገኘም። ማጣሪያውን ለማጽዳት «ሁሉንም አሳይ» ማለት ይችላሉ።',
        om: 'Hojiin deeggarsa filatame guutu hin argamne. Calallii haquuf "hunda agarsiisi" jechuu dandeessu.',
        ti: 'ነቲ ዝተመረጸ ድጋፍ ዘማልእ ናይ ስራሕ ቦታ ኣይተረኽበን። ምጽራይ ንምልዓል «ኩሎም ኣርእየኒ» ክትብሉ ትኽእሉ ኢኹም።',
        en: 'No open jobs found matching the selected accommodations. You can say "Show all" to clear filters.',
      });
    } else {
      const jobSummaries = jobCards.map((card, idx) => {
        const title = card.querySelector('.op-job-title')?.textContent?.trim() || '';
        const company = card.querySelector('.op-job-company')?.textContent?.trim() || '';
        const numLabel = this.t({
          am: `${idx + 1}ኛ፦`,
          om: `${idx + 1}ffaa:`,
          ti: `${idx + 1}ይ፦`,
          en: `${idx + 1}:`,
        });
        const atLabel = this.t({
          am: 'በ',
          om: 'dhaabbata',
          ti: 'ኣብ',
          en: 'at',
        });
        if (company) {
          return `${numLabel} ${title} ${atLabel} ${company}`;
        }
        return `${numLabel} ${title}`;
      });

      const countHeader = this.t({
        am: `${count} የሚስማሙ ክፍት የሥራ ቦታዎች ተገኝተዋል፦`,
        om: `Hojiilee ${count} walsiman argamaniiru:`,
        ti: `${count} ዝሰማምዑ ናይ ስራሕ ቦታታት ተረኺቦም ኣለዉ፦`,
        en: `Found ${count} matching jobs:`,
      });

      const filterIntro = customPrefix || this.t({
        am: 'የመረጡት ማጣሪያ ተተግብሯል።',
        om: 'Calalliin filatame hojiirra ooleera.',
        ti: 'ዝመረጽኩምዎ ምጽራይ ተተግቢሩ ኣሎ።',
        en: 'Filter applied.',
      });

      msg = `${filterIntro} ${countHeader} ${jobSummaries.join('፤ ')}።`;
    }

    this.announce(msg);
    this.readExecutor.speak(msg, this.locale);
  }

  private handleJobsFilterVoiceAction(utterance: string): boolean {
    const filterContainer = document.querySelector<HTMLElement>('.op-job-filter-chips, .op-job-filter-fieldset');
    const isJobsPage = Boolean(
      filterContainer || document.querySelector('.op-job-listing-page')
    );
    if (!isJobsPage || !filterContainer) return false;

    const raw = utterance.trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();

    // 1. Clear filters request
    const isClearRequest = /(?:ሁሉንም|ሁሉ|አጽዳ|አሳይ|ሁሉንም\s*አሳይ|hunda|agarsiisi|hunda\s*agarsiisi|ኩሉ|ኩሎም|ኣጽሪ|ኩሎም\s*ኣርእየኒ|clear\s*filter|clear\s*filters|clear|all\s*jobs|show\s*all|reset\s*filter)/iu.test(lower);
    if (isClearRequest) {
      const clearBtn = document.querySelector<HTMLButtonElement>('.op-filter-clear-btn');
      if (clearBtn) {
        clearBtn.click();
      } else {
        const checkedBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('.op-job-filter-chip input[type="checkbox"]:checked'));
        for (const cb of checkedBoxes) cb.click();
      }
      const msg = this.t({
        am: 'ማጣሪያው ተነስቷል። ሁሉንም ክፍት የሥራ ቦታዎች እያሳየን ነው።',
        om: 'Calalliin haqameera. Hojiilee hunda agarsiisaa jirra.',
        ti: 'ምጽራይ ተላዒሉ ኣሎ። ኩሎም ናይ ስራሕ ቦታታት ይርኣዩ ኣለዉ።',
        en: 'Filters cleared. Showing all open jobs.',
      });
      this.announce(msg);
      setTimeout(() => {
        this.readFilteredJobs(msg);
      }, 250);
      return true;
    }

    // 2. Read jobs request
    const isReadJobs = /(?:ስራዎቹን\s*(?:አንብብ|አንብቢ|አንብቢልኝ|ንገረኝ|ዘርዝር)|ስራዎችን\s*(?:አንብብ|አንብቢ|አንብቢልኝ|ንገረኝ|ዘርዝር)|ምን\s*ስራ\s*አለ|ምን\s*ስራዎች\s*አሉ|የስራ\s*ዝርዝር|hojiiwwan\s*(?:dubbisi|tarreessi)|hojii\s*kam|ስራሕቲ\s*(?:ኣንብብ|ኣንብበለይ|ዘርዝር)|እንታይ\s*ስራሕ|read\s*jobs|list\s*jobs|show\s*jobs|tell\s*me\s*jobs|what\s*jobs)/iu.test(lower);
    if (isReadJobs) {
      this.readFilteredJobs();
      return true;
    }

    // 3. Apply / Register transition for jobs
    const isApplyRequest = /(?:አመልክት|ይህን\s*ሥራ\s*አመልክት|ሥራውን\s*አመልክት|ይመዝገቡ|መዝግብ|hojii\s*kana\s*iyyannoo|iyyannoo|galmaa'i|ኣመልክት|እዚ\s*ስራሕ\s*ኣመልክት|ተመዝገብ|apply|apply\s*for\s*this|register)/iu.test(lower);
    if (isApplyRequest) {
      const applyBtn = document.querySelector<HTMLButtonElement>('.op-job-card .op-btn-apply, .op-job-listing-footer .op-btn-continue');
      if (applyBtn) {
        const msg = this.t({
          am: 'ወደ ሥራ ማመልከቻ ቅጹ እየሄድን ነው።',
          om: 'Gara unka iyyannoo hojiitti ce\'aa jirra.',
          ti: 'ናብ ናይ ስራሕ መመልከቲ ቅጺ ንኸይድ ኣለና።',
          en: 'Navigating to the job application form.',
        });
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        setTimeout(() => applyBtn.click(), 400);
        return true;
      }
    }

    // 4. Accommodation Filter matching (single or multi-select!)
    const chips = Array.from(filterContainer.querySelectorAll<HTMLElement>('.op-job-filter-chip'));
    if (chips.length === 0) return false;

    // Accommodation definitions with multi-language semantic patterns
    const accDefs = [
      {
        value: 'step-free',
        index: 0,
        pattern: /(?:ደረጃ\s*የሌለው|ደረጃ\s*የሌለው\s*መግቢያ|መግቢያ|ደረጃ|ዊልቸር|መንኮራኩር|seensa\s*sadarkaa|sadarkaa\s*hin\s*qabne|ደረጃ\s*ዘይብሉ|ደረጃ\s*ዘይብሉ\s*ምእተዊ|መንኰርኰር|step[- ]free|step[- ]free\s*entrance|entrance|wheelchair|ramp)/iu,
        ordinal: /(?:^|\s|[፣፤፥።፡,.\?!&])(?:1|1ኛ|1st|first|jalqabaa|ቀዳማይ)(?:$|\s|[፣፤፥።፡,.\?!&])/iu,
      },
      {
        value: 'remote',
        index: 1,
        pattern: /(?:ከቤት|ከቤት\s*መሥራት|ከቤት\s*መስራት|በቤት|የርቀት|mana\s*taa'?anii|mana\s*ta'?anii|mana\s*taa'?ee|mana\s*hojjechuu|ካብ\s*ገዛ|ካብ\s*ገዛ\s*ምስራሕ|remote|remote\s*work|work\s*from\s*home|wfh|home\s*based)/iu,
        ordinal: /(?:^|\s|[፣፤፥።፡,.\?!&])(?:2|2ኛ|2nd|second|lammaffaa|ካልኣይ)(?:$|\s|[፣፤፥።፡,.\?!&])/iu,
      },
      {
        value: 'flexible',
        index: 2,
        pattern: /(?:ተለዋዋጭ|ተለዋዋጭ\s*ሰዓት|ተለዋዋጭ\s*የስራ\s*ሰዓት|ተለዋዋጭ\s*የሥራ\s*ሰዓት|የስራ\s*ሰዓት|የሥራ\s*ሰዓት|sa'?aatii\s*jijjiiramaa|saatii\s*jijjiiramaa|jijjiiramaa|ተለዋዋጢ|ተለዋዋጢ\s*ሰዓታት|ተለዋዋጢ\s*ሰዓት|flexible|flexible\s*hours|flex\s*hours|flexible\s*time)/iu,
        ordinal: /(?:^|\s|[፣፤፥።፡,.\?!&])(?:3|3ኛ|3rd|third|sadaffaa|ሳልሳይ)(?:$|\s|[፣፤፥።፡,.\?!&])/iu,
      },
      {
        value: 'screen-reader',
        index: 3,
        pattern: /(?:ስክሪን\s*አንባቢ|የስክሪን\s*አንባቢ|ስክሪን\s*ሪደር|አንባቢ\s*ሶፍትዌር|ሶፍትዌር|iskiriinii\s*dubbisu|iskiriinii\s*dubbisaa|iskiriinii|ስክሪን\s*ኣንባቢ|ናይ\s*ስክሪን\s*ኣንባቢ|screen[- ]reader|screen[- ]reader\s*software)/iu,
        ordinal: /(?:^|\s|[፣፤፥።፡,.\?!&])(?:4|4ኛ|4th|fourth|afurffaa|ራብዓይ)(?:$|\s|[፣፤፥።፡,.\?!&])/iu,
      },
      {
        value: 'sign-language',
        index: 4,
        pattern: /(?:ምልክት\s*ቋንቋ|የምልክት\s*ቋንቋ|አስተርጓሚ|ምልክት|afaan\s*mallattoo|turjumaana|mallattoo|ምልክት\s*ቋንቋ|ናይ\s*ምልክት\s*ቋንቋ|ኣተርጓሚ|sign[- ]language|sign[- ]language\s*interpreter|interpreter)/iu,
        ordinal: /(?:^|\s|[፣፤፥።፡,.\?!&])(?:5|5ኛ|5th|fifth|shanaffaa|ሓሙሻይ)(?:$|\s|[፣፤፥።፡,.\?!&])/iu,
      },
      {
        value: 'adapted-desk',
        index: 5,
        pattern: /(?:ምቹ\s*የሥራ\s*ጠረጴዛ|ምቹ\s*የስራ\s*ጠረጴዛ|ምቹ\s*ጠረጴዛ|ጠረጴዛ|ዴስክ|minjaala|minjaala\s*mijataa|teessoo|ምቹእ\s*መንበር|መንበር\s*ወይ\s*ጠረጴዛ|ምቹእ\s*ጠረጴዛ|adapted[- ]desk|ergonomic\s*desk|desk|table)/iu,
        ordinal: /(?:^|\s|[፣፤፥።፡,.\?!&])(?:6|6ኛ|6th|sixth|jaffaa|ሳድሳይ)(?:$|\s|[፣፤፥።፡,.\?!&])/iu,
      },
    ];

    const isRemove = /(?:አንሳ|አውጣ|አስወግድ|አስወጣ|አትምረጥ|uncheck|remove|deselect|dhiisi|baasi|ኣልዕል|ኣውጽእ)/iu.test(lower);

    // Find all chips that match the user request
    const matchedChips: HTMLElement[] = [];

    accDefs.forEach(def => {
      const chip = chips[def.index] || chips.find(c => c.getAttribute('data-acc-value') === def.value);
      if (!chip) return;

      const labelText = (chip.querySelector('.op-chip-label')?.textContent || chip.textContent || '').toLowerCase();

      const matchesPattern = def.pattern.test(lower);
      const matchesOrdinal = def.ordinal.test(lower);
      const matchesLabelDirect = labelText.length > 3 && lower.includes(labelText);

      if (matchesPattern || matchesOrdinal || matchesLabelDirect) {
        if (!matchedChips.includes(chip)) {
          matchedChips.push(chip);
        }
      }
    });

    if (matchedChips.length === 0) {
      // Fallback: check if the utterance matches any chip's direct text content
      for (const chip of chips) {
        const text = (chip.querySelector('.op-chip-label')?.textContent || chip.textContent || '').trim().toLowerCase();
        if (text && (lower.includes(text) || text.includes(lower))) {
          if (!matchedChips.includes(chip)) matchedChips.push(chip);
        }
      }
    }

    if (matchedChips.length === 0) return false;

    // Apply filter state to matched chips
    const selectedNames: string[] = [];
    for (const chip of matchedChips) {
      const input = chip.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!input) continue;
      const labelText = chip.querySelector('.op-chip-label')?.textContent?.trim() || chip.textContent?.trim() || '';
      selectedNames.push(labelText);

      if (isRemove) {
        if (input.checked) {
          input.click();
        }
      } else {
        if (!input.checked) {
          input.click();
        }
      }
    }

    // Announce feedback and read filtered jobs after brief DOM render delay
    const actionText = isRemove
      ? this.t({
          am: `«${selectedNames.join('፣ ')}» ከማጣሪያ ተነስቷል።`,
          om: `"${selectedNames.join(', ')}" calallii keessaa haqameera.`,
          ti: `«${selectedNames.join('፣ ')}» ካብ ምጽራይ ተላዒሉ ኣሎ።`,
          en: `"${selectedNames.join(', ')}" removed from filters.`,
        })
      : this.t({
          am: `«${selectedNames.join('፣ ')}» ተመርጧል።`,
          om: `"${selectedNames.join(', ')}" filatameera.`,
          ti: `«${selectedNames.join('፣ ')}» ተመሪጹ ኣሎ።`,
          en: `"${selectedNames.join(', ')}" selected.`,
        });

    setTimeout(() => {
      this.readFilteredJobs(actionText);
    }, 250);

    return true;
  }

  private tryDirectVoiceAction(utterance: string): boolean {
    const raw = utterance.trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();

    // 0-job. Job Listing View Accommodation Filters & Search (/jobs)
    if (this.handleJobsFilterVoiceAction(utterance)) return true;

    // 0. Consent & Agreement for statement/consent screens (e.g. referral agreement to share name/phone)
    const isConsentPhrase = /(?:ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|ፈቃደኛ\s*ነኝ|ስምምነት|ስምምነቴን|ይሰጥ|ተሰማሚዐ|ተሰማሚዐ\s*ኣለኹ|ይወሃብ|ሕራይ|walii\s*nan\s*gala|walii\s*galeera|eeyyee|eeyyeen|tole|haa\s*kennamu|i\s*agree|agree|i\s*consent|consent|yes)/iu.test(lower) ||
      (/(?:^|\s|[፣፤፥።፡,.\?!])(?:አዎ|እሺ|yes|ok|okay|eyyee|eeyyeen|እወ|ሕራይ)(?:$|\s|[፣፤፥።፡,.\?!])/iu.test(lower) && Boolean(document.querySelector('#op-main label.op-check input[type="checkbox"], #op-main input[type="checkbox"]')));

    if (isConsentPhrase) {
      const consentLabel = document.querySelector<HTMLElement>('#op-main label.op-check, #op-main .op-options label');
      const consentCheckbox = consentLabel?.querySelector<HTMLInputElement>('input[type="checkbox"]') ||
        document.querySelector<HTMLInputElement>('#op-main input[type="checkbox"]');
      if (consentCheckbox && consentLabel) {
        return this.selectOptionAndAdvance(consentLabel, consentCheckbox, this.t({ am: 'ስምምነት', om: 'Waliigaltee', ti: 'ስምምዕነት', en: 'Consent' }));
      }
    }

    // 0b. Refusal / Decline on consent screens
    if (/(?:አልስማማም|አልፈልግም|አይሆንም|አልፈቅድም|ኣይሰማማዕን|ኣይደልን|ኣይፋልን|walii\s*hin\s*galu|hin\s*barbaadu|lakki|disagree|decline|don'?t\s*agree)/iu.test(lower)) {
      const consentCheckbox = document.querySelector<HTMLInputElement>('#op-main label.op-check input[type="checkbox"], #op-main input[type="checkbox"]');
      if (consentCheckbox) {
        const msg = this.t({
          am: 'ስምምነት ካልሰጡ ወደ ኋላ ተመልሰን ሌላ አማራጭ መምረጥ እንችላለን። ወደ ኋላ እየተመለስን ነው።',
          om: 'Waliigaltee yoo hin kennine gara duubatti deebinee filannoo biraa filachuu dandeenya. Gara duubatti deebi\'aa jirra.',
          ti: 'ስምምዕነት እንተዘይሂብኩም ንድሕሪት ተመሊስና ካልእ ኣማራጺ ክንመርጽ ንኽእል ኢና። ንድሕሪት ንምለስ ኣለና።',
          en: 'If you do not agree, we can go back and choose another option. Going back.',
        });
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        const backBtn = document.querySelector<HTMLButtonElement>('#op-main button.op-btn-back, button.op-btn-back');
        if (backBtn) setTimeout(() => backBtn.click(), 400);
        return true;
      }
    }

    // 0c. Review screen: inquiries about answers & editing fields
    const reviewItems = this.getReviewItems();
    if (reviewItems.length > 0) {
      // 1. User asks to list or read all answered questions
      if (/(?:ዘርዝር|አንብብ|አንብቢ|አንብቢልኝ|ዝርዝር|መልሶቼን|የመለስኩትን|ምን\s*መለስኩ|የመዘገብኩትን|ምን\s*መዘገብኩ|ዝመለስክዎ\s*ንገረኒ|እንታይ\s*መሊሰ|መልስታተይ|deebii\s*koo|tarreessi|deebiiwwan\s*koo|read\s*answers|list\s*answers|what\s*did\s*i\s*answer|my\s*answers|review\s*answers)/iu.test(lower)) {
        const summary = this.buildStepSummary('normal');
        this.announce(summary);
        this.readExecutor.speak(summary, this.locale);
        return true;
      }

      // 2. Targeted inquiries about specific answers
      if (/(?:ስሜ\s*(?:ማን|ምን)|ስሜ\s*ምን\s*ተብሏል|ስም\s*ምን\s*ነው|ስሜን\s*ንገረኝ|ስሜ\s*ማነው|ስመይ\s*መን|ስመይ\s*መን\s*እዩ|ስመይ\s*ንገረኒ|maqaan\s*koo\s*eenyu|maqaa\s*koo|maqaan\s*koo\s*maali|what\s*is\s*my\s*name)/iu.test(lower)) {
        const item = reviewItems.find(i => i.question.includes('ስም') || i.question.includes('ስመይ') || i.question.toLowerCase().includes('name') || i.question.toLowerCase().includes('maqaa'));
        if (item) {
          const msg = this.t({
            am: `የተመዘገበው ስምዎ «${item.answer}» ነው።`,
            om: `Maqaan galmaa'e "${item.answer}" dha.`,
            ti: `ዝተመዝገበ ስምኩም «${item.answer}» እዩ።`,
            en: `Your registered name is "${item.answer}".`,
          });
          this.announce(msg); this.readExecutor.speak(msg, this.locale); return true;
        }
      }
      if (/(?:ኢሜይሌ\s*(?:ስንት|ምን)|ኢሜይል|ኢሜይሌ\s*ምን\s*ነው|ኢሜይሌን\s*ንገረኝ|ናይ\s*ኢሜይል|imeelii\s*koo|iimaylkayga|what\s*is\s*my\s*email)/iu.test(lower)) {
        const item = reviewItems.find(i => i.question.includes('ኢሜይል') || i.question.toLowerCase().includes('email') || i.question.toLowerCase().includes('imeel') || i.question.toLowerCase().includes('iimayl'));
        if (item) {
          const msg = this.t({
            am: `የተመዘገበው ኢሜይል «${item.answer}» ነው።`,
            om: `Imeeliin galmaa'e "${item.answer}" dha.`,
            ti: `ዝተመዝገበ ኢሜይል «${item.answer}» እዩ።`,
            so: `Iimaylka la diiwaangeliyay waa "${item.answer}".`,
            en: `Your registered email is "${item.answer}".`,
          });
          this.announce(msg); this.readExecutor.speak(msg, this.locale); return true;
        }
      }
      if (/(?:ስልኬ\s*(?:ስንት|ምን)|ስልክ\s*ቁጥሬ|ስልኬ\s*ስንት\s*ነው|ስልኬን\s*ንገረኝ|ናይ\s*ስልኪ\s*ቍጽረይ|ስልከይ\s*ክንደይ|ስልከይ\s*ንገረኒ|lakkoofsi\s*bilbila\s*koo|bilbila\s*koo|what\s*is\s*my\s*phone)/iu.test(lower)) {
        const item = reviewItems.find(i => i.question.includes('ስልክ') || i.question.includes('ስልኪ') || i.question.toLowerCase().includes('phone') || i.question.toLowerCase().includes('bilbila'));
        if (item) {
          const msg = this.t({
            am: `የተመዘገበው ስልክ ቁጥርዎ «${item.answer}» ነው።`,
            om: `Lakkoofsi bilbilaa galmaa'e "${item.answer}" dha.`,
            ti: `ዝተመዝገበ ናይ ስልኪ ቍጽርኹም «${item.answer}» እዩ።`,
            en: `Your registered phone number is "${item.answer}".`,
          });
          this.announce(msg); this.readExecutor.speak(msg, this.locale); return true;
        }
      }
      if (/(?:ኢሜይሌ\s*(?:ስንት|ምን)|ኢሜይል|ኢሜይሌ\s*ምን\s*ነው|ኢሜይሌን\s*ንገረኝ|ናይ\s*ኢሜይል|imeelii\s*koo|iimaylkayga|what\s*is\s*my\s*email)/iu.test(lower)) {
        const item = reviewItems.find(i => i.question.includes('ኢሜይል') || i.question.toLowerCase().includes('email') || i.question.toLowerCase().includes('imeel') || i.question.toLowerCase().includes('iimayl'));
        if (item) {
          const msg = this.t({
            am: `የተመዘገበው ኢሜይል «${item.answer}» ነው።`,
            om: `Imeeliin galmaa'e "${item.answer}" dha.`,
            ti: `ዝተመዝገበ ኢሜይል «${item.answer}» እዩ።`,
            so: `Iimaylka la diiwaangeliyay waa "${item.answer}".`,
            en: `Your registered email is "${item.answer}".`,
          });
          this.announce(msg); this.readExecutor.speak(msg, this.locale); return true;
        }
      }
      if (/(?:ምን\s*ቋንቋ|ቋንቋዬ\s*ምንድን|ምን\s*ቋንቋ\s*መረጥኩ|እንታይ\s*ቋንቋ|እንታይ\s*ቋንቋ\s*መሪጸ|afaaniin\s*filadhe|afaan\s*kam|what\s*language)/iu.test(lower)) {
        const item = reviewItems.find(i => i.question.includes('ቋንቋ') || i.question.toLowerCase().includes('language') || i.question.toLowerCase().includes('afaan'));
        if (item) {
          const msg = this.t({
            am: `የመረጡት ቋንቋ «${item.answer}» ነው።`,
            om: `Afaan filattan "${item.answer}" dha.`,
            ti: `ዝመረጽኩምዎ ቋንቋ «${item.answer}» እዩ።`,
            en: `Your selected language is "${item.answer}".`,
          });
          this.announce(msg); this.readExecutor.speak(msg, this.locale); return true;
        }
      }
      if (/(?:ምን\s*(?:መታወቂያ|ሰነድ)|መታወቂያዬ\s*ምን|ምን\s*ሰነድ\s*መረጥኩ|እንታይ\s*(?:መታወቂያ|ሰነድ)|መታወቂያይ\s*እንታይ|waraqaa\s*eenyummaa\s*kam|sanada\s*kam|what\s*id|what\s*document)/iu.test(lower)) {
        const item = reviewItems.find(i => i.question.includes('መታወቂያ') || i.question.includes('ማንነት') || i.question.toLowerCase().includes('id') || i.question.toLowerCase().includes('waraqaa') || i.question.toLowerCase().includes('sanada'));
        if (item) {
          const msg = this.t({
            am: `የመረጡት የመታወቂያ አማራጭ «${item.answer}» ነው።`,
            om: `Filannoon waraqaa eenyummaa "${item.answer}" dha.`,
            ti: `ዝመረጽኩምዎ ናይ መታወቂያ ኣማራጺ «${item.answer}» እዩ።`,
            en: `Your selected ID route is "${item.answer}".`,
          });
          this.announce(msg); this.readExecutor.speak(msg, this.locale); return true;
        }
      }

      // 3. User requests to edit or change a question
      const isEditRequest = /(?:ቀይር|አስተካክል|ላስተካክል|ልቀይር|አስተካክለው|ቀይረው|ኣዐሪ|ቀይሮ|jijjiiri|sirreessi|edit|change|modify|correct)/iu.test(lower);
      if (isEditRequest) {
        let targetItem = reviewItems.find(i => {
          if (/(?:ስም|ስመይ|maqaa|name)/iu.test(lower) && (i.question.includes('ስም') || i.question.includes('ስመይ') || i.question.toLowerCase().includes('name') || i.question.toLowerCase().includes('maqaa'))) return true;
          if (/(?:ስልክ|ስልኪ|bilbila|phone)/iu.test(lower) && (i.question.includes('ስልክ') || i.question.includes('ስልኪ') || i.question.toLowerCase().includes('phone') || i.question.toLowerCase().includes('bilbila'))) return true;
          if (/(?:ኢሜይል|imeel|iimayl|email)/iu.test(lower) && (i.question.includes('ኢሜይል') || i.question.toLowerCase().includes('email') || i.question.toLowerCase().includes('imeel') || i.question.toLowerCase().includes('iimayl'))) return true;
          if (/(?:ቋንቋ|afaan|language|lang)/iu.test(lower) && (i.question.includes('ቋንቋ') || i.question.toLowerCase().includes('language') || i.question.toLowerCase().includes('afaan'))) return true;
          if (/(?:መታወቂያ|ሰነድ|ማንነት|waraqaa|sanada|id|document)/iu.test(lower) && (i.question.includes('መታወቂያ') || i.question.includes('ማንነት') || i.question.toLowerCase().includes('id') || i.question.toLowerCase().includes('waraqaa') || i.question.toLowerCase().includes('sanada'))) return true;
          if (/(?:አጋር|ስምምነት|እገዛ|ሓጋዚ|መሻርኽቲ|tumsa|gargaarsa|partner|referral)/iu.test(lower) && (i.question.includes('አጋር') || i.question.includes('ስምምነት') || i.question.toLowerCase().includes('partner') || i.question.toLowerCase().includes('tumsa'))) return true;
          if (/(?:ቅጽ|ቅጹ|ምርጫ|አሠራር|unka|accessibility|support)/iu.test(lower) && (i.question.includes('ቅጽ') || i.question.includes('ቅጹ') || i.question.toLowerCase().includes('support') || i.question.toLowerCase().includes('unka'))) return true;
          return false;
        });

        // Check ordinals: first, second, 3rd, etc.
        if (!targetItem) {
          if (/(?:የመጀመሪያ|አንደኛ|ቀዳማይ|ሓደ|jalqabaa|tokkoffaa|1st|first)/iu.test(lower)) targetItem = reviewItems[0];
          else if (/(?:ሁለተኛ|ካልኣይ|ክልተ|lammaffaa|2nd|second)/iu.test(lower)) targetItem = reviewItems[1];
          else if (/(?:ሶስተኛ|ሦስተኛ|ሳልሳይ|ሰለስተ|sadaffaa|3rd|third)/iu.test(lower)) targetItem = reviewItems[2];
          else if (/(?:አራተኛ|ራብዓይ|ኣርባዕተ|afurffaa|4th|fourth)/iu.test(lower)) targetItem = reviewItems[3];
          else if (/(?:አምስተኛ|ሓሙሻይ|ሓሙሽተ|shanaffaa|5th|fifth)/iu.test(lower)) targetItem = reviewItems[4];
        }

        if (targetItem && targetItem.editBtn) {
          const msg = this.t({
            am: `ስለ «${targetItem.question}» ለማስተካከል ወደ ጥያቄው እየሄድን ነው።`,
            om: `Waa'ee "${targetItem.question}" sirreessuuf gara gaaffichaatti ce'aa jirra.`,
            ti: `ብዛዕባ «${targetItem.question}» ንምዕራይ ናብቲ ሕቶ ንኸይድ ኣለና።`,
            en: `Navigating to edit "${targetItem.question}".`,
          });
          this.announce(msg);
          this.readExecutor.speak(msg, this.locale);

          // Check if user also gave a replacement value inline (e.g. "ስሜን ወደ ካሳሁን ቀይር")
          const valueMatch = raw.match(/(?:ወደ\s+([^\s]+(?:\s+[^\s]+)?)\s+(?:ቀይር|አድርግ|አስተካክል)|gara\s+([^\s]+(?:\s+[^\s]+)?)\s+jijjiiri|change\s+(?:my\s+)?(?:name|phone)\s+to\s+([^\s]+(?:\s+[^\s]+)?))/iu);
          const inlineVal = valueMatch ? (valueMatch[1] || valueMatch[2] || valueMatch[3]) : null;

          targetItem.editBtn.click();

          if (inlineVal) {
            setTimeout(() => {
              const textInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
                '#op-main input.op-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), #op-main textarea.op-input'
              );
              if (textInput) {
                this.fillTextInput(textInput, inlineVal);
              }
            }, 350);
          }
          return true;
        }

        // General edit request without specific field
        const msg = this.t({
          am: 'የትኛውን ጥያቄ ማስተካከል ይፈልጋሉ? «ስም ቀይር» ወይም «ስልክ አስተካክል» ማለት ይችላሉ።',
          om: 'Gaaffii isa kam sirreessuu barbaaddu? "maqaa jijjiiri" ykn "bilbila jijjiiri" jechuu dandeessu.',
          ti: 'ኣየናይ ሕቶ ከተዐርዩ ትደልዩ? «ስም ቀይር» ወይ «ስልኪ ቀይር» ክትብሉ ትኽእሉ ኢኹም።',
          en: 'Which question would you like to edit? You can say "Edit name" or "Change phone".',
        });
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        return true;
      }
    }

    // 1. Next step / Proceed
    if (/^(?:ቀጣይ|ቀጥል|ወደፊት|ሂድ|ቀጻሊ|ቀጽል|ንቕድሚት|itti\s*fufi|itti\s*fufa|gara\s*fuulduraatti|fuulduratti|kan\s*itti\s*aanu|hore|soco|hore\s*u\s*soco|next|continue|forward|proceed)/iu.test(lower) ||
        /(?:ቀጣይ\s*ደረጃ|ቀጻሊ\s*ደረጃ|sadarkaa\s*itti\s*aanu|tallaabada\s*xigta|next\s*step|ቀጣዩ|ቀጣይ|ቀጻሊ)/iu.test(lower)) {
      this.advanceToNextStep();
      return true;
    }

    // 1b. Stop / silence / pause
    if (/^(?:አቁም|ዝም|ዝም\s*በይ|ዝም\s*በል|ቆይ|ደው|ስቕ|cal'?isi|dhaabi|jooji|aamus|stop|pause|quiet|be\s*quiet|silence)\b/iu.test(lower)) {
      this.readExecutor.stop();
      const msg = this.t({
        am: 'ዝም ብያለሁ።',
        om: 'Cal\'iseera.',
        ti: 'ስቕ ኢለ ኣለኹ።',
        so: 'Waa la joojiyay.',
        en: 'Stopping.',
      });
      this.announce(msg);
      return true;
    }

    // 2. Previous step / Back
    if (/^(?:ተመለስ|ወደ\s*ኋላ|ቀዳሚ|ንድሕሪት|ዝሓለፈ|gara\s*duubatti|duubatti|deebi'?i|deebi'?aa|dib|dib\s*u\s*noqo|back|previous|go\s*back)\b/iu.test(lower) ||
        /(?:ያለፈው\s*ደረጃ|ዝሓለፈ\s*ደረጃ|sadarkaa\s*duraanii|tallaabadii\s*hore|previous\s*step)/iu.test(lower)) {
      const backBtn = document.querySelector<HTMLButtonElement>('#op-main button.op-btn-back, button.op-btn-back, button[aria-label*="Back"], button[aria-label*="ተመለስ"]');
      if (backBtn) {
        const msg = this.t({
          am: 'ወደ ቀደመው ደረጃ ተመልሰናል።',
          om: 'Gara sadarkaa duraatti deebineerra.',
          ti: 'ናብ ዝሓለፈ ደረጃ ተመሊስና ኣለና።',
          so: 'Dib ayaan ugu noqonnay tallaabadii hore.',
          en: 'Going back to the previous step.',
        });
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        setTimeout(() => backBtn.click(), 300);
        return true;
      }
    }

    // 3. Read aloud
    if (/^(?:አንብብ|አንብቢ|አንብቢልኝ|ስማ|ኣንብብ|ኣንብበለይ|ስማዕ|dubbisi|naaf\s*dubbisi|dhaggeeffadhu|sagalee|akhri|iila\s*akhri|dhageyso|read|speak|listen)\b/iu.test(lower)) {
      const msg = this.t({
        am: 'ጥያቄውን ላንብብልዎት።',
        om: 'Gaafficha isiniif nan dubbisa.',
        ti: 'ሕቶኡ ከንብበልኩም እየ።',
        so: 'Su\'aasha kor ayaan kuugu akhrinayaa.',
        en: 'Reading the question aloud.',
      });
      this.announce(msg);
      this.readExecutor.readTarget('page.main', this.locale);
      return true;
    }

    // 3b. Simple/child-friendly explanation
    if (/(?:ቀላል|ቀጥተኛ|ቀላሉን|አብራራ|ቀላል\s*ቃል|ቀሊል|ብቀሊሉ|ግለጸለይ|ኣረድኣኒ|salphaa|salphaatti|naaf\s*ibsi|ibsi|fudud|erayo\s*fudud|like\s*a\s*kid|simply|simple|explain\s*simply|easy\s*words)/iu.test(lower)) {
      this.simpleMode.apply(true, this.rootElement || document.body, this.locale as any);
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
    if (/(?:ትልቅ\s*ጽሑፍ|ጽሑፉን\s*አተልቅ|ጽሑፍ\s*አተልቅ|ዓቢ\s*ጽሑፍ|ጽሑፍ\s*ኣዕብዮ|barreeffama\s*guddosi|guddisi|barreeffama\s*guddaa|qoraal\s*weyn|weyneey|make\s*text\s*bigger|bigger\s*text|zoom)/iu.test(lower)) {
      const nextScale = this.textScale.getPercent() >= 150 ? 100 : 150;
      this.textScale.apply(nextScale as 100 | 150);
      const msg = this.t({
        am: 'የጽሑፉ መጠን እንዲተልቅ ተደርጓል።',
        om: 'Hangi barreeffamaa guddateera.',
        ti: 'መጠን ጽሑፍ ዓብዩ ኣሎ።',
        so: 'Cabbirka qoraalka waa la weyneeyay.',
        en: 'Text size has been increased.',
      });
      this.announce(msg);
      this.readExecutor.speak(msg, this.locale);
      return true;
    }

    // 5. High contrast
    if (/(?:ከፍተኛ\s*ንፅፅር|ንፅፅር|ላዕለዋይ\s*ንጽጽር|ንጽጽር|garaagarummaa\s*guddaa|haala\s*dukkanaa|kala\s*duwanaansho|high\s*contrast|dark\s*mode)/iu.test(lower)) {
      const nextTheme = this.contrast.getTheme() === 'high-contrast' ? 'default' : 'high-contrast';
      this.contrast.applyContrast(nextTheme);
      const msg = this.t({
        am: 'የቀለም ንፅፅር ተቀይሯል።',
        om: 'Haalli halluu jijjiirameera.',
        ti: 'ንጽጽር ሕብሪ ተቐዪሩ ኣሎ።',
        so: 'Habka kala duwanaanshaha waa la beddelay.',
        en: 'Contrast mode toggled.',
      });
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
      .replace(/^(?:እኔ\s+)?(?:የምመርጠው\s+|የምፈልገው\s+|እመርጣለሁ\s+|እፈልጋለሁ\s+|filannoon\s*koo\s+|filadha\s+)?/iu, '')
      .replace(/^(?:እባክሽን\s+|እባክህ\s+|እባክዎ\s+|እባክዎት\s+)?(?:ይምረጡ\s+|ይምረጡልኝ\s+|ምረጥ\s+|ምረጪ\s+|አድርግ\s+|አድርጊ\s+|አድርግልኝ\s+|filadhu\s+|filaa\s+)?/iu, '')
      .replace(/(?:የሚለውን|የሚለውን\s+አማራጭ|እመርጣለሁ|እፈልጋለሁ|ነው\s+የምመርጠው|ነው\s+የምፈልገው|filadha|filachuu\s*barbaada)$/iu, '')
      .trim();

    // 6a. "This option" / "This one" / "ይህን" / "ይሄን" / "kana"
    const isThis = /^(?:this\s*(?:one|option)?|that\s*(?:one|option)?|here|ይህ(?:ን|ንን)?|ይሄ(?:ን|ንን)?|ይኸው|ይህንኑ|እዚ|እዚኣ|kana|kanuma)$/iu.test(cleanUtt) ||
      /(?:i\s+choose\s+this|i\s+pick\s+this|choose\s+this|select\s+this|ይህን\s*ምረጥ|ይሄን\s*ምረጥ|kana\s*filadhu)/iu.test(lower);
    if (isThis && optionLabels.length > 0) {
      const checkedLabel = optionLabels.find(l => {
        const inp = l.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
        return inp?.checked;
      }) || optionLabels[0];
      const inp = checkedLabel?.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
      if (checkedLabel && inp) {
        return this.selectOptionAndAdvance(checkedLabel, inp, this.t({ am: 'ይህ አማራጭ', om: 'Filannoo kana', ti: 'እዚ ኣማራጺ', so: 'Doorashadan', en: 'This option' }));
      }
    }

    // 6b. Ordinal & Letter selection: first, second, A, B, 1, 2, etc.
    const isFirst = /(?:የመጀመሪያ|አንደኛ|ቀዳማይ|ሓደ|jalqabaa|tokkoffaa|kowaad|koowaad|midka\s*hore|first|1st|^1$|^a$|^ሀ$|^አ$)/iu.test(cleanUtt) || /(?:option\s*(?:1|a)|አማራጭ\s*(?:1|አ|ሀ))/iu.test(lower);
    const isSecond = /(?:ሁለተኛ|ካልኣይ|ክልተ|lammaffaa|labaad|second|2nd|^2$|^b$|^ለ$)/iu.test(cleanUtt) || /(?:option\s*(?:2|b)|አማራጭ\s*(?:2|ለ))/iu.test(lower);
    const isThird = /(?:ሶስተኛ|ሦስተኛ|ሳልሳይ|ሰለስተ|sadaffaa|saddexaad|third|3rd|^3$|^c$|^ሐ$)/iu.test(cleanUtt) || /(?:option\s*(?:3|c)|አማራጭ\s*(?:3|ሐ))/iu.test(lower);
    const isFourth = /(?:አራተኛ|ራብዓይ|ኣርባዕተ|afurffaa|afraad|fourth|4th|^4$|^d$|^መ$)/iu.test(cleanUtt) || /(?:option\s*(?:4|d)|አማራጭ\s*(?:4|መ))/iu.test(lower);
    const isFifth = /(?:አምስተኛ|ሓሙሻይ|ሓሙሽተ|shanaffaa|shanaad|fifth|5th|^5$|^e$|^ሠ$|^ረ$)/iu.test(cleanUtt) || /(?:option\s*(?:5|e)|አማራጭ\s*(?:5|ሠ|ረ))/iu.test(lower);
    const isLast = /(?:የመጨረሻ|ናይ\s*መወዳእታ|dhuma|ugu\s*dambey(?:a|nta)?|last)\b/iu.test(cleanUtt);

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
    if (/(?:ሰነድ|መታወቂያ|ፎቶ)\s*(?:የለኝም|የለም)|የለኝም|የለም|ሰነድ\s*የብለይን|የብለይን|sanada\s*hin\s*qabu|hin\s*qabu|ragaa\s*hin\s*qabu|አጋር|እገዛ|እርዳታ|በአጋር|ድርጅት|እፈልጋለሁ|ሓጋዚ|መሻርኽቲ|tumsa|gargaarsa|refer|partner|no\s*id|no\s*document|don'?t\s*have/iu.test(lower)) {
      const referLabel = optionLabels.find(l => {
        const inp = l.querySelector<HTMLInputElement>('input');
        return inp?.value === 'refer' || /የለኝም|አጋር|እገዛ|ሓጋዚ|መሻርኽቲ|tumsa|gargaarsa|refer|partner/i.test(l.textContent || '');
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
      const isKebele = (val === 'kebele' || cleanLabel.includes('ቀበሌ') || cleanLabel.includes('ganda')) && /ቀበሌ|kebele|ganda/iu.test(lower);
      const isRefugee = (val === 'refugee' || cleanLabel.includes('ስደተኛ') || cleanLabel.includes('baqataa')) && /ስደተኛ|refugee|baqataa/iu.test(lower);
      const isOther = (val === 'other' || cleanLabel.includes('ሌላ') || cleanLabel.includes('ካልእ') || cleanLabel.includes('biroo')) && /ሌላ|ካልእ|biroo|other|another|ፓስፖርት|መንጃ/iu.test(lower) && !/(?:የለኝም|አጋር|እገዛ|hin\s*qabu)/iu.test(lower);
      const isRefer = (val === 'refer' || cleanLabel.includes('አጋር') || cleanLabel.includes('የለኝም') || cleanLabel.includes('hin qabu') || cleanLabel.includes('የብለይን')) &&
        /(?:ሰነድ\s*(?:የለኝም|የለም)|የለኝም|የለም|ሰነድ\s*የብለይን|የብለይን|sanada\s*hin\s*qabu|hin\s*qabu|ragaa\s*hin\s*qabu|አጋር|እገዛ|እርዳታ|በአጋር|ድርጅት|እፈልጋለሁ|ሓጋዚ|መሻርኽቲ|tumsa|gargaarsa|refer|partner|no\s*id|no\s*document|don'?t\s*have)/iu.test(lower);
      const isAgree = (val === 'agree-share' || cleanLabel.includes('ተስማምቻለሁ') || cleanLabel.includes('ይሰጥ') || cleanLabel.includes('walii') || cleanLabel.includes('ተሰማሚዐ')) &&
        /(?:ተስማምቻለሁ|እስማማለሁ|ፈቅጃለሁ|ፈቃደኛ\s*ነኝ|ስምምነት|ስምምነቴን|ይሰጥ|ተሰማሚዐ|ይወሃብ|ሕራይ|walii\s*nan\s*gala|walii\s*galeera|eeyyee|eeyyeen|tole|haa\s*kennamu|i\s*agree|agree|consent)/iu.test(lower);

      const isAmharicOption = /አማርኛ|amharic/i.test(labelText) || val === 'am';
      const isEnglishOption = /english|እንግሊዝኛ/i.test(labelText) || val === 'en';
      const isOromoOption = /oromoo|oromo|oromiffa|ኦሮምኛ|ኦሮሞ/i.test(labelText) || val === 'om';
      const isTigrinyaOption = /ትግርኛ|ትግራይ|tigrinya|tigrigna/i.test(labelText) || val === 'ti';
      const isSomaliOption = /soomaali|somali|af-soomaali|ሶማሊ/i.test(labelText) || val === 'so';
      const mentionsAmharic = /አማርኛ|amharic/i.test(lower);
      const mentionsEnglish = /english|እንግሊዝኛ/i.test(lower);
      const mentionsOromo = /oromoo|oromo|oromiffa|ኦሮምኛ|ኦሮሞ/i.test(lower);
      const mentionsTigrinya = /ትግርኛ|ትግራይ|tigrinya|tigrigna/i.test(lower);
      const mentionsSomali = /soomaali|somali|af-soomaali|ሶማሊ/i.test(lower);

      // Extract significant words and strip Amharic prefixes (e.g. የፋይዳ -> ፋይዳ, የቀበሌ -> ቀበሌ)
      const stopWords = ['option', 'አማራጭ', 'label', 'ሰነድ', 'የሰነድ', 'መታወቂያ', 'የመታወቂያ', 'document', 'id', 'waraqaa', 'sanada'];
      const words = cleanLabel.split(/\s+/).filter(w => w.length >= 3 && !stopWords.includes(w));
      const wordMatch = words.some(w => {
        const root = w.replace(/^[የበለከወ]/, '');
        return lower.includes(w) || (root.length >= 3 && !stopWords.includes(root) && lower.includes(root));
      });

      if (directMatch || valMatch || isAgree || isRefer || isFayda || isKebele || isRefugee || isOther ||
          wordMatch || (isAmharicOption && mentionsAmharic) || (isEnglishOption && mentionsEnglish) ||
          (isOromoOption && mentionsOromo) || (isTigrinyaOption && mentionsTigrinya) || (isSomaliOption && mentionsSomali)) {
        return this.selectOptionAndAdvance(label, input);
      }
    }

    // 6d. File upload & Photo camera trigger (Step 6)
    const fileInput = document.querySelector<HTMLInputElement>('#op-main input[type="file"], input[type="file"]');
    if (fileInput) {
      if (/(?:ፎቶ|ካሜራ|ስቀል|ፋይል|ምረጥ|መታወቂያ|ሰነድ|suuraa|kaameraa|olkaa'aa|faayilii|photo|camera|upload|file|choose|take)/iu.test(lower) &&
          !/(?:የለኝም|የለም|የብለይን|hin\s*qabu|don'?t|no)/iu.test(lower)) {
        const msg = this.t({
          am: 'የካሜራ ወይም የፋይል መምረጫው ተከፍቷል። ፎቶ ያንሱ ወይም ሰነድ ይምረጡ።',
          om: 'Kaameraan ykn filannoon faayilii banameera. Suuraa kaasaa ykn sanada filadhaa.',
          ti: 'ናይ ካሜራ ወይ ፋይል መምረጺ ተኸፊቱ ኣሎ። ፎቶ ኣልዕሉ ወይ ሰነድ ምረጹ።',
          en: 'File and camera picker opened. Please take a photo or select your document.',
        });
        this.announce(msg);
        this.readExecutor.speak(msg, this.locale);
        fileInput.focus();
        fileInput.click();
        return true;
      }

      if (/(?:ሰነድ|መታወቂያ|ፎቶ)\s*(?:የለኝም|የለም)|የለኝም|የብለይን|hin\s*qabu|sanada\s*hin\s*qabu|no\s*document|no\s*id|don'?t\s*have/iu.test(lower)) {
        const msg = this.t({
          am: 'ሰነድ ከሌለዎት ወደ ኋላ ተመልሰን የአጋር ድርጅት እገዛ መምረጥ እንችላለን። ወደ ኋላ እየተመለስን ነው።',
          om: 'Sanada yoo hin qabaanne gara duubatti deebinee gargaarsa dhaabbata tumsaa filachuu dandeenya. Gara duubatti deebi\'aa jirra.',
          ti: 'ሰነድ እንተዘይብልኩም ንድሕሪት ተመሊስና ናይ መሻርኽቲ ትካል ሓገዝ ክንመርጽ ንኽእል ኢና። ንድሕሪት ንምለስ ኣለና።',
          en: 'If you do not have a document, we can go back and choose partner help. Going back.',
        });
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
    if (textInput) {
      const isExplicitDictation = /^(?:ስሜ\s+|my\s*name\s*is\s+|maqaan\s*koo\s+|maqaa\s*koo\s+|ani\s+|ስመይ\s+|ስመይ\s*ዝበሃል\s+|መልስ\s*:?\s*|ይህ\s*ነው\s*|ስም\s*:?\s*|ቁጥሬ\s*|ቁጥሬ\s*ነው\s*|ስልኬ\s*|bilbilli\s*koo\s*|ስልከይ\s*)/iu.test(raw);
      const cleanVal = raw
        .replace(/^(?:my\s*name\s*is\s+|i\s*am\s+|call\s*me\s+|it\s*is\s+|answer\s*:?\s*|maqaan\s*koo\s+|maqaa\s*koo\s+|ani\s+|ስሜ\s+|ስሜ\s*የሚባለው\s+|የምባለው\s+|ስመይ\s+|ስመይ\s*ዝበሃል\s+|መልስ\s*:?\s*|ይህ\s*ነው\s*|ስም\s*:?\s*|ቁጥሬ\s*|ቁጥሬ\s*ነው\s*|የስልክ\s*ቁጥሬ\s*|bilbilli\s*koo\s*|ስልከይ\s*)/iu, '')
        .replace(/(?:\s+ነው|\s+ናቸው|\s+ይባላል|\s+እዩ|\s+እዮም|\s+dha)$/iu, '')
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
    let panel = this.assistantPanel;
    const isNew = !panel;
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'roha-assistant-panel';
      panel.className = 'roha-aside';
      panel.setAttribute('data-roha-ignore', 'true');
      panel.setAttribute('data-roha-assistant', 'true');
    }
    
    panel.lang = this.locale;
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
          <button id="roha-wake-trigger" type="button" class="roha-wake-pill" style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;padding:3px 8px;border-radius:12px;background:#eef2ff;color:#1e40af;font-weight:600;letter-spacing:0.02em;border:none;cursor:pointer;" title="${this.t({
            en: 'Say "Roha" or click to wake',
            am: '"ሮሃ" ይበሉ ወይም እዚህ ይጫኑ',
            om: '"Roha" jedhaa ykn as tuqaa',
            ti: '"ሮሃ" በሉ ወይ ኣብዚ ጠውቁ',
            so: 'Dheh "Roha" ama riix halkan',
          })}">🎙️ ${this.t({
            en: 'Say "Roha"',
            am: '"ሮሃ" ይበሉ',
            om: '"Roha" jedhaa',
            ti: '"ሮሃ" በሉ',
            so: 'Dheh "Roha"',
          })}</button>
        </div>
        <p class="roha-subtitle">${text('roha.inlineIntro')}</p>
        <div class="roha-grid roha-top-actions">
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
        <form class="roha-command-form">
          <label for="roha-command">${text('roha.request')}</label>
          <div class="roha-input-row">
            <input id="roha-command" name="request" type="text" maxlength="1000" autocomplete="off" placeholder="${text('roha.request')}" />
            <button class="roha-btn-primary-blue" type="submit">${text('roha.send')}</button>
          </div>
        </form>
        <label data-ai-consent-label class="roha-consent-label"><input type="checkbox" data-ai-consent checked style="accent-color: #002b56; min-width: 20px; min-height: 20px; cursor: pointer;"> ${text('roha.aiConsent')}</label>
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
    if (isNew) {
      document.body.appendChild(panel);
    }
    document.body.classList.add('roha-layout');
    this.assistantPanel = panel;
    this.liveRegion = panel.querySelector('[data-roha-control="roha-live-region"]');
    const pill = panel.querySelector('[data-roha-control="roha-launcher-pill"]') as HTMLButtonElement;
    const wakeTrigger = panel.querySelector('[data-roha-control="roha-wake-trigger"]') as HTMLButtonElement | null;
    const command = panel.querySelector<HTMLInputElement>('[data-roha-control="roha-command"]')!;
    pill.addEventListener('click', () => { command.focus(); this.handleWakeWordActivation(); });
    wakeTrigger?.addEventListener('click', () => { command.focus(); this.handleWakeWordActivation(); });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        this.requestVersion++; this.guide.reset(); this.readExecutor.stop(); this.voice.stopListening();
        this.announce(text('roha.stopped')); pill.focus();
      }
    });
    panel.querySelector('[data-roha-guide]')?.addEventListener('click', () => { this.rescan(); this.guide.start(); });
    panel.querySelector('[data-roha-forward]')?.addEventListener('click', () => { this.rescan(); this.advanceToNextStep(); });
    panel.querySelector('[data-roha-back]')?.addEventListener('click', () => this.guide.back());
    panel.querySelector('[data-roha-confirm]')?.addEventListener('click', () => { void this.guide.confirm(); command.focus(); });
    panel.querySelector('[data-roha-cancel]')?.addEventListener('click', () => { this.guide.cancel(); command.focus(); });
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
        const descEl = panel.querySelector('[data-ai-description]');
        if (descEl) descEl.textContent = config.provider === 'disabled' ? text('roha.aiDisabled') : rc('roha.aiSelected', this.locale, { provider: providerNames[config.provider] || text('roha.aiCustom'), model: config.model });
        const consentLabel = panel.querySelector<HTMLElement>('[data-ai-consent-label]');
        if (consentLabel) consentLabel.hidden = false;
        serverProvider = provider; this.setLLMProvider(provider);
        consent.disabled = false;
        consent.checked = true;
        provider.consent(true);
      } catch {
        consent.disabled = false;
        consent.checked = true;
        const consentLabel = panel.querySelector<HTMLElement>('[data-ai-consent-label]');
        if (consentLabel) consentLabel.hidden = false;
        if (!autoConsent) this.announce(text('roha.notUnderstood'));
      }
    };
    const aiOptBtn = panel.querySelector<HTMLButtonElement>('[data-ai-options]');
    if (aiOptBtn) aiOptBtn.onclick = () => void initProvider(false);
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
