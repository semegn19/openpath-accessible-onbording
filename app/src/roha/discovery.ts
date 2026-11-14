import { rc } from './copy';
/**
 * Roha - Automatic Page Discovery Engine
 * Features: D01, D02, D05, D06
 * Discovers semantic DOM elements, computes accessible names,
 * categorizes risk and privacy, and registers handles in the TargetRegistry.
 */

import {
  DiscoveredResource,
  DiscoveredPageMap,
  ResourceKind,
  NameSource,
  PrivacyClass,
  FieldType,
  RohaIntentType,
  HostOverride,
  Locale,
} from './types';
import { TargetRegistry } from './registry';

export interface DiscoveryOptions {
  root?: Element | null;
  mapId?: string;
  mapVersion?: number;
  routeKey?: string;
  locale?: Locale;
  overrides?: HostOverride[];
}

export class DiscoveryEngine {
  private registry: TargetRegistry;
  private overrides: HostOverride[];
  private locale: Locale = 'en';

  constructor(registry: TargetRegistry, overrides: HostOverride[] = []) {
    this.registry = registry;
    this.overrides = overrides;
  }

  public discover(options: DiscoveryOptions = {}): DiscoveredPageMap {
    const root = options.root || document.querySelector('#main') || document.body;
    const mapId = options.mapId || this.registry.getMapId() || 'roha-map';
    const mapVersion = options.mapVersion || this.registry.getMapVersion() || 1;
    const routeKey = options.routeKey || this.extractRouteKey();
    const locale: Locale = options.locale || 'en';
    this.locale = locale;

    this.registry.clear();
    this.registry.updateVersion(mapVersion);

    const resources: DiscoveredResource[] = [];
    const idCounters: Record<string, number> = {};

    const generateId = (prefix: string): string => {
      idCounters[prefix] = (idCounters[prefix] || 0) + 1;
      return idCounters[prefix] === 1 ? prefix : `${prefix}-${idCounters[prefix]}`;
    };

    // 1. Discover the main page container as root region
    let pageMainId = 'page.main';
    this.registry.register(pageMainId, root);
    
    // Find heading or title for main region
    const mainHeading = root.querySelector('h1');
    const mainName = mainHeading?.textContent?.trim() || document.title || rc('roha.mainContent', this.locale);

    resources.push({
      id: pageMainId,
      kind: 'region',
      name: mainName,
      nameSource: mainHeading ? 'text' : 'semantic-context',
      visible: this.isVisible(root),
      enabled: true,
      risk: 'read-only',
      allowedIntents: [
        'read',
        'explain',
        'text_scale',
        'simple_mode',
        'contrast',
        'reduced_motion',
        'reset_preferences',
        'pause',
        'resume',
        'undo',
      ],
      privacy: 'page-metadata',
    });

    // 2. Walk semantic elements within root
    this.walkElements(root, pageMainId, resources, generateId);

    // 3. Apply any host overrides
    this.applyOverrides(resources);

    return {
      schemaVersion: '2.0',
      mapId,
      mapVersion,
      routeKey,
      locale,
      origin: 'runtime-discovery',
      resources,
    };
  }

  /**
   * Generates a developer-only compatibility report (Feature D07)
   */
  public generateCompatibilityReport(map: DiscoveredPageMap): {
    timestamp: number;
    totalResources: number;
    unlabelledControls: string[];
    ambiguousControls: string[];
    privacyBreakdown: Record<PrivacyClass, number>;
    unsupportedControls: string[];
    isCompatible: boolean;
  } {
    const unlabelled: string[] = [];
    const nameMap = new Map<string, string[]>();
    const privacyCount: Record<PrivacyClass, number> = {
      'page-metadata': 0,
      'application': 0,
      'private-support': 0,
      'identity': 0,
      'unclassified': 0,
    };
    const unsupported: string[] = [];

    const iframes = typeof document !== 'undefined' ? document.querySelectorAll('iframe') : [];
    Array.from(iframes).forEach((f) => unsupported.push(`iframe[src="${f.src || 'inline'}"]`));
    const canvases = typeof document !== 'undefined' ? document.querySelectorAll('canvas') : [];
    Array.from(canvases).forEach(() => unsupported.push('HTMLCanvasElement'));

    for (const r of map.resources) {
      privacyCount[r.privacy] = (privacyCount[r.privacy] || 0) + 1;

      if (!r.name || r.nameSource === 'none') {
        unlabelled.push(r.id);
      }

      if (r.kind === 'button' || r.kind === 'field') {
        const existing = nameMap.get(r.name) || [];
        existing.push(r.id);
        nameMap.set(r.name, existing);
      }
    }

    const ambiguous: string[] = [];
    for (const [name, ids] of nameMap.entries()) {
      if (ids.length > 1) {
        ambiguous.push(`${name} (${ids.join(', ')})`);
      }
    }

    return {
      timestamp: Date.now(),
      totalResources: map.resources.length,
      unlabelledControls: unlabelled,
      ambiguousControls: ambiguous,
      privacyBreakdown: privacyCount,
      unsupportedControls: unsupported,
      isCompatible: unlabelled.length === 0,
    };
  }

  private walkElements(
    container: Element,
    currentParentId: string,
    resources: DiscoveredResource[],
    generateId: (prefix: string) => string
  ): void {
    const children = Array.from(container.children);

    for (const el of children) {
      // Exclude Roha UI elements
      if (
        el.hasAttribute('data-roha-ignore') ||
        el.hasAttribute('data-roha-assistant') ||
        el.closest('[data-roha-ignore]')
      ) {
        continue;
      }

      if (!this.isVisible(el)) {
        continue;
      }

      const tagName = el.tagName.toLowerCase();

      // Detect Jobs (sections/articles with titles or role cards)
      if (tagName === 'section' || tagName === 'article') {
        const heading = el.querySelector('h2, h3, h4');
        const headingText = heading?.textContent?.trim();
        const hasApplyOrAction = el.querySelector('button, a');

        if (headingText && hasApplyOrAction) {
          // This represents a job or featured card
          const slug = this.slugify(headingText);
          const jobId = generateId(`job.${slug || 'item'}`);
          this.registry.register(jobId, el);

          resources.push({
            id: jobId,
            parentId: currentParentId,
            kind: 'job',
            name: headingText,
            nameSource: 'text',
            visible: true,
            enabled: true,
            risk: 'read-only',
            allowedIntents: ['read', 'focus'],
            privacy: 'page-metadata',
          });

          // Recurse into this job section
          this.walkElements(el, jobId, resources, generateId);
          continue;
        }
      }

      // Detect Forms
      if (tagName === 'form') {
        const { name, source } = this.resolveAccessibleName(el, 'form');
        const formId = generateId('form.signup');
        this.registry.register(formId, el);

        resources.push({
          id: formId,
          parentId: currentParentId,
          kind: 'form',
          name: name || rc('roha.form', this.locale),
          nameSource: source,
          visible: true,
          enabled: true,
          risk: 'external-write',
          allowedIntents: ['read', 'review', 'request_submission'],
          privacy: 'page-metadata',
        });

        // Walk inside form
        this.walkElements(el, formId, resources, generateId);
        continue;
      }

      // Detect Input / Textarea / Select
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        const inputEl = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const inputType = (inputEl.getAttribute('type') || 'text').toLowerCase();

        if (inputType === 'hidden') continue;

        if (inputType === 'button' || inputType === 'submit') {
          // Process as button
          this.processButton(inputEl, currentParentId, resources, generateId);
          continue;
        }

        const { name, source } = this.resolveAccessibleName(inputEl, 'field');
        const isPrivate =
          inputEl.getAttribute('data-roha-private') === 'true' ||
          inputEl.name?.includes('support') ||
          inputEl.id?.includes('support');

        const isIdentity =
          inputEl.name?.includes('id') ||
          inputEl.id?.includes('id') ||
          inputEl.name?.includes('route');

        let privacy: PrivacyClass = 'application';
        if (isPrivate) privacy = 'private-support';
        else if (isIdentity) privacy = 'identity';

        // Check if it's a search / filter control
        const isSearchOrFilter =
          inputType === 'search' ||
          inputEl.name?.includes('needs') ||
          inputEl.name?.includes('search') ||
          inputEl.name?.includes('filter') ||
          inputEl.id?.includes('search');

        let kind: ResourceKind = isSearchOrFilter ? 'search' : 'field';
        let fieldType: FieldType = 'text';

        if (tagName === 'textarea') fieldType = 'textarea';
        else if (tagName === 'select') fieldType = 'select';
        else if (inputType === 'email') fieldType = 'email';
        else if (inputType === 'tel') fieldType = 'tel';
        else if (inputType === 'file') fieldType = 'file';
        else if (inputType === 'password') fieldType = 'secure-input';

        const baseSlug = inputEl.id || inputEl.name || this.slugify(name) || 'input';
        const fieldId = generateId(isSearchOrFilter ? `field.${baseSlug}` : `field.${baseSlug}`);
        this.registry.register(fieldId, inputEl);

        const allowedIntents: RohaIntentType[] = isSearchOrFilter
          ? ['focus', 'filter', 'search']
          : fieldType === 'file'
          ? ['read', 'explain', 'focus', 'choose_file']
          : ['read', 'explain', 'focus', 'propose_answer'];

        const res: DiscoveredResource = {
          id: fieldId,
          parentId: currentParentId,
          kind,
          name: name || rc('roha.inputField', this.locale),
          nameSource: source,
          visible: true,
          enabled: !inputEl.disabled,
          risk: 'local-change',
          allowedIntents,
          privacy,
          fieldType,
          required: (inputEl as HTMLInputElement).required || false,
        };

        if (tagName === 'select') {
          const selectEl = inputEl as HTMLSelectElement;
          const options = Array.from(selectEl.options)
            .filter((opt) => opt.value !== '')
            .map((opt) => ({
              id: `route.${this.slugify(opt.value || opt.text)}`,
              label: opt.text.trim(),
            }));
          if (options.length > 0) {
            res.options = options;
          }
        }

        resources.push(res);
        continue;
      }

      // Detect Buttons
      if (tagName === 'button' || el.getAttribute('role') === 'button') {
        this.processButton(el, currentParentId, resources, generateId);
        continue;
      }

      // Detect Headings (if not already captured as section name)
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        // Only register if standalone or important landmark
        const text = el.textContent?.trim();
        if (text && el.parentElement?.tagName.toLowerCase() !== 'section') {
          const headingId = generateId(`heading.${this.slugify(text) || 'item'}`);
          this.registry.register(headingId, el);
          resources.push({
            id: headingId,
            parentId: currentParentId,
            kind: 'heading',
            name: text,
            nameSource: 'text',
            visible: true,
            enabled: true,
            risk: 'read-only',
            allowedIntents: ['read', 'explain', 'focus'],
            privacy: 'page-metadata',
          });
        }
      }

      // Recurse down children
      this.walkElements(el, currentParentId, resources, generateId);
    }
  }

  private processButton(
    el: Element,
    currentParentId: string,
    resources: DiscoveredResource[],
    generateId: (prefix: string) => string
  ): void {
    const { name, source } = this.resolveAccessibleName(el, 'button');
    const isSubmit =
      el.getAttribute('type') === 'submit' ||
      name.toLowerCase().includes('submit') ||
      name.toLowerCase().includes('finish');

    // Contextual button naming (e.g. data-apply vs support-apply)
    let parentSlug = '';
    if (currentParentId.startsWith('job.')) {
      parentSlug = currentParentId.replace('job.', '') + '-';
    }

    const buttonSlug = `${parentSlug}${this.slugify(name) || 'btn'}`;
    const buttonId = generateId(`button.${buttonSlug}`);
    this.registry.register(buttonId, el);

    const allowedIntents: RohaIntentType[] = isSubmit
      ? ['focus', 'navigate', 'review', 'request_submission']
      : ['focus', 'navigate'];

    resources.push({
      id: buttonId,
      parentId: currentParentId,
      kind: 'button',
      name: name || rc('roha.button', this.locale),
      nameSource: source,
      visible: true,
      enabled: !(el as HTMLButtonElement).disabled,
      risk: isSubmit ? 'external-write' : 'unknown',
      allowedIntents,
      privacy: 'page-metadata',
    });
  }

  private resolveAccessibleName(
    el: Element,
    elementRole: 'field' | 'button' | 'form'
  ): { name: string; source: NameSource } {
    // 1. aria-labelledby
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const labelEl = document.getElementById(labelledby);
      if (labelEl && labelEl.textContent?.trim()) {
        return { name: labelEl.textContent.trim(), source: 'aria-labelledby' };
      }
    }

    // 2. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.trim()) {
      return { name: ariaLabel.trim(), source: 'aria-label' };
    }

    // 3. <label for="..."> or parent <label>
    if (elementRole === 'field') {
      const id = el.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label && label.textContent?.trim()) {
          return { name: label.textContent.trim(), source: 'label' };
        }
      }

      const parentLabel = el.closest('label');
      if (parentLabel && parentLabel.textContent?.trim()) {
        return { name: parentLabel.textContent.trim(), source: 'label' };
      }
    }

    // 4. Visible text content
    if (elementRole === 'button' || elementRole === 'form') {
      const text = el.textContent?.trim();
      if (text) {
        // For buttons, take button text
        return { name: text.split('\n')[0].trim(), source: 'text' };
      }
    }

    // 5. title or placeholder fallback
    const title = el.getAttribute('title');
    if (title?.trim()) {
      return { name: title.trim(), source: 'none' };
    }

    const placeholder = el.getAttribute('placeholder');
    if (placeholder?.trim()) {
      return { name: placeholder.trim(), source: 'none' };
    }

    return { name: '', source: 'none' };
  }

  private applyOverrides(resources: DiscoveredResource[]): void {
    if (!this.overrides || this.overrides.length === 0) return;

    for (const override of this.overrides) {
      try {
        const matched = document.querySelectorAll(override.targetSelector);
        for (const el of Array.from(matched)) {
          const regId = this.registry.getId(el);
          if (regId) {
            const res = resources.find((r) => r.id === regId);
            if (res) {
              if (override.kind) res.kind = override.kind;
              if (override.name) {
                res.name = override.name;
                res.nameSource = 'host-override';
              }
              if (override.privacy) res.privacy = override.privacy;
              if (override.allowedIntents) res.allowedIntents = override.allowedIntents;
            }
          }
        }
      } catch {
        // Invalid selector, ignore gracefully
      }
    }
  }

  private isVisible(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return true;
    if (el.hidden) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
      return false;
    }
    return true;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);
  }

  private extractRouteKey(): string {
    const path = window.location?.pathname || 'default';
    const clean = path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9_-]/gi, '-');
    return clean || 'home';
  }
}
