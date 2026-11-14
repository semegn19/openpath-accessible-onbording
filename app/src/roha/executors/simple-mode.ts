/**
 * Roha - Simple Explanation Mode Executor
 * Feature: A02
 * Provides simplified phrasing while keeping original text accessible.
 * Preserves consent, eligibility rules, and legal meaning.
 */

export const SIMPLIFIED_DICTIONARY: Record<string, { en: string; am: string }> = {
  'Which identity route works for you?': {
    en: 'Choose how to show who you are',
    am: 'እራስዎን የሚገልጹበትን መንገድ ይምረጡ',
  },
  'What should we call you?': {
    en: 'Your name',
    am: 'ስምዎ ማን ይባላል?',
  },
  'What would make learning easier?': {
    en: 'Tell us any help you need',
    am: 'ምን ዓይነት ድጋፍ ይፈልጋሉ?',
  },
  'Learner registration': {
    en: 'Sign up here',
    am: 'እዚህ ይመዝገቡ',
  },
  'Support I need': {
    en: 'Help I want at work',
    am: 'በሥራ ቦታ የምፈልገው ድጋፍ',
  },
};

export class SimpleModeExecutor {
  private enabled: boolean = false;
  private modifiedElements: Map<Element, string> = new Map();

  public isEnabled(): boolean {
    return this.enabled;
  }

  public apply(enabled: boolean, root: Element = document.body, locale: 'en' | 'am' = 'en'): boolean {
    this.enabled = enabled;

    if (!enabled) {
      // Restore all elements with data-roha-original
      const elementsWithOriginal = (root || document.body).querySelectorAll('[data-roha-original]');
      for (const el of Array.from(elementsWithOriginal)) {
        const orig = el.getAttribute('data-roha-original');
        if (orig) {
          el.textContent = orig;
          el.removeAttribute('data-roha-original');
        }
      }

      for (const [el, originalText] of this.modifiedElements.entries()) {
        if (el.isConnected) {
          el.textContent = originalText;
          el.removeAttribute('data-roha-original');
        }
      }
      this.modifiedElements.clear();
      return true;
    }

    // Apply simplified copy
    const textNodes: Element[] = Array.from(root.querySelectorAll('label, h1, h2, h3, h4, h5, h6, legend, p, span'));
    for (const el of textNodes) {
      if (el.hasAttribute('data-roha-ignore')) continue;
      // Only replace leaf elements to prevent clobbering nested inputs/controls
      if (el.childElementCount > 0) continue;

      const text = el.textContent?.trim() || '';
      const simplified = SIMPLIFIED_DICTIONARY[text];

      if (simplified) {
        if (!this.modifiedElements.has(el)) {
          this.modifiedElements.set(el, text);
        }
        el.textContent = locale === 'am' ? simplified.am : simplified.en;
        el.setAttribute('data-roha-original', text);
      }
    }

    return true;
  }

  public getOriginalText(el: Element): string | undefined {
    return this.modifiedElements.get(el) || el.getAttribute('data-roha-original') || undefined;
  }
}
