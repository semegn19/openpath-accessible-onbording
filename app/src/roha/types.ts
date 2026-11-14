/**
 * Roha - Core Type Definitions
 * Strictly matches schemas/site-map.schema.json, schemas/intent.schema.json, schemas/capabilities.schema.json
 */

export type Locale = 'en' | 'am' | 'ti' | 'om';

export type ResourceKind =
  | 'region'
  | 'heading'
  | 'form'
  | 'field'
  | 'button'
  | 'link'
  | 'menu'
  | 'search'
  | 'table'
  | 'document'
  | 'job'
  | 'status';

export type NameSource =
  | 'label'
  | 'aria-labelledby'
  | 'aria-label'
  | 'text'
  | 'semantic-context'
  | 'host-override'
  | 'none';

export type RiskLevel = 'read-only' | 'local-change' | 'external-write' | 'unknown';

export type PrivacyClass =
  | 'page-metadata'
  | 'application'
  | 'private-support'
  | 'identity'
  | 'unclassified';

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'file'
  | 'secure-input';

export type RohaIntentType =
  | 'text_scale'
  | 'simple_mode'
  | 'contrast'
  | 'reduced_motion'
  | 'read'
  | 'explain'
  | 'focus'
  | 'navigate'
  | 'search'
  | 'filter'
  | 'propose_answer'
  | 'choose_file'
  | 'review'
  | 'request_submission'
  | 'request_support'
  | 'pause'
  | 'resume'
  | 'undo'
  | 'reset_preferences';

export interface FieldOption {
  id: string;
  label: string;
}

export interface DiscoveredResource {
  id: string;
  parentId?: string;
  kind: ResourceKind;
  name: string;
  nameSource: NameSource;
  visible: boolean;
  enabled: boolean;
  risk: RiskLevel;
  allowedIntents: RohaIntentType[];
  privacy: PrivacyClass;
  fieldType?: FieldType;
  required?: boolean;
  options?: FieldOption[];
  maxLength?: number;
  accept?: string[];
}

export interface DiscoveredPageMap {
  schemaVersion: '2.0';
  mapId: string;
  mapVersion: number;
  routeKey: string;
  locale: Locale;
  origin: 'runtime-discovery' | 'illustrative-shape-only';
  resources: DiscoveredResource[];
}

export interface BaseIntent {
  schemaVersion: '2.0';
  utteranceId: string;
  mapId: string;
  mapVersion: number;
  intent: RohaIntentType;
  targetId: string;
}

export interface TextScaleIntent extends BaseIntent {
  intent: 'text_scale';
  payload: { percent: 100 | 125 | 150 | 175 | 200 };
}

export interface ContrastIntent extends BaseIntent {
  intent: 'contrast';
  payload: { theme: 'default' | 'high-contrast' };
}

export interface SimpleModeIntent extends BaseIntent {
  intent: 'simple_mode';
  payload: { enabled: boolean };
}

export interface ReducedMotionIntent extends BaseIntent {
  intent: 'reduced_motion';
  payload: { enabled: boolean };
}

export interface SearchIntent extends BaseIntent {
  intent: 'search';
  payload: { query: string };
}

export interface FilterIntent extends BaseIntent {
  intent: 'filter';
  payload: { query: string };
}

export interface ExplainIntent extends BaseIntent {
  intent: 'explain';
  payload: { stuckReason?: string };
}

export interface ReadIntent extends BaseIntent {
  intent: 'read';
  payload: { repeat?: boolean };
}

export interface NavigateIntent extends BaseIntent {
  intent: 'navigate';
  payload: { direction?: 'back' | 'forward' };
}

export interface ProposeAnswerIntent extends BaseIntent {
  intent: 'propose_answer';
  payload: { value: string; partial?: 'first' | 'last'; partToKeep?: 'first' | 'last' };
}

export interface EmptyPayloadIntent extends BaseIntent {
  intent:
    | 'focus'
    | 'choose_file'
    | 'review'
    | 'request_submission'
    | 'request_support'
    | 'pause'
    | 'resume'
    | 'undo'
    | 'reset_preferences';
  payload: Record<string, any>;
}

export type RohaIntent =
  | TextScaleIntent
  | ContrastIntent
  | SimpleModeIntent
  | ReducedMotionIntent
  | SearchIntent
  | FilterIntent
  | ExplainIntent
  | ReadIntent
  | NavigateIntent
  | ProposeAnswerIntent
  | EmptyPayloadIntent;

export type CapabilityStatus = 'planned' | 'not-tested' | 'partial' | 'verified' | 'unavailable';

export interface CapabilityEvidenceItem {
  status: CapabilityStatus;
  offlineReady: boolean;
  evidenceRef?: string;
  reason?: string;
}

export interface LanguageCapabilities {
  ui: CapabilityEvidenceItem;
  commands: CapabilityEvidenceItem;
  transcription: CapabilityEvidenceItem;
  dynamicTts: CapabilityEvidenceItem;
  promptAudio: CapabilityEvidenceItem;
  wake: CapabilityEvidenceItem;
}

export interface LanguageMatrixEntry {
  tag: Locale;
  capabilities: LanguageCapabilities;
}

export interface RohaCapabilities {
  schemaVersion: '2.0';
  profile: 'device-local' | 'local-hub' | 'remote-opt-in';
  device: string;
  languages: LanguageMatrixEntry[];
}

export interface HostOverride {
  targetSelector: string;
  kind?: ResourceKind;
  name?: string;
  privacy?: PrivacyClass;
  allowedIntents?: RohaIntentType[];
  customHandler?: (intent: RohaIntent) => Promise<boolean>;
}

export interface RohaMountOptions {
  root?: HTMLElement | string;
  language?: Locale;
  mode?: 'guided' | 'embed' | 'overlay';
  runtimeProfile?: 'device-local' | 'local-hub' | 'remote-opt-in';
  hostAdapter?: HostAdapter;
  overrides?: HostOverride[];
}

export interface HostAdapter {
  submitForm?(formId: string, data: Record<string, any>): Promise<{ success: boolean; receipt?: string; error?: string }>;
  getAuthStatus?(): { authenticated: boolean; user?: string };
  onSessionExpiry?(callback: () => void): void;
  getCustomControls?(): HostOverride[];
}

export interface IntentValidationResult {
  valid: boolean;
  errors: string[];
}

