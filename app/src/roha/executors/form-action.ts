/**
 * Roha - Form Action & Execution Engine
 * Features: O01, O02, O07, C02
 * Safely interacts with real host inputs, textareas, selects, and buttons.
 * Dispatches standard DOM events to ensure host framework reactivity.
 */

import { TargetRegistry } from '../registry';
import { HostAdapter } from '../types';

export class FormActionExecutor {
  private registry: TargetRegistry;
  private hostAdapter?: HostAdapter;

  constructor(registry: TargetRegistry, hostAdapter?: HostAdapter) {
    this.registry = registry;
    this.hostAdapter = hostAdapter;
  }

  public setHostAdapter(adapter: HostAdapter): void {
    this.hostAdapter = adapter;
  }

  public proposeAnswer(targetId: string, value: string): boolean {
    const el = this.registry.getElement(targetId);
    if (!el || el.matches(':disabled, [readonly]')) return false;

    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') {
        if (!['true', 'false', 'yes', 'no'].includes(value.toLowerCase())) return false;
        const checked = ['true', 'yes'].includes(value.toLowerCase());
        if (el.checked !== checked) el.click();
        return el.checked === checked;
      } else if (el.type === 'radio') {
        if (el.value.toLowerCase() !== value.toLowerCase()) return false;
        if (!el.checked) el.click();
        return el.checked;
      } else {
        if (['file', 'password', 'hidden', 'submit', 'button', 'reset', 'image'].includes(el.type)) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
      }
      this.dispatchChangeEvents(el);
      return true;
    }

    if (el instanceof HTMLTextAreaElement) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value);
      this.dispatchChangeEvents(el);
      return true;
    }

    if (el instanceof HTMLSelectElement) {
      const lower = value.toLowerCase().trim();
      const matches = Array.from(el.options).filter(opt => !opt.disabled && opt.value !== '' &&
        (opt.value.toLowerCase() === lower || opt.text.trim().toLowerCase() === lower));
      if (matches.length === 1) {
        el.value = matches[0].value;
        this.dispatchChangeEvents(el);
        return true;
      }
    }

    return false;
  }

  public focusTarget(targetId: string): boolean {
    const el = this.registry.getElement(targetId);
    if (!el) return false;

    if (el instanceof HTMLElement) {
      const focusable = el.matches('input, button, select, textarea, a[href], [tabindex]') ? el
        : el.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || el;
      if (!focusable.hasAttribute('tabindex') && focusable.tabIndex < 0) focusable.setAttribute('tabindex', '-1');
      focusable.focus();
      focusable.scrollIntoView({ behavior: 'instant', block: 'center' });
      return focusable.ownerDocument.activeElement === focusable;
    }

    return false;
  }

  public chooseFile(targetId: string): boolean {
    const el = this.registry.getElement(targetId);
    if (!el || !(el instanceof HTMLInputElement) || el.type !== 'file') {
      return false;
    }

    // Native file picker must be learner-controlled (O07)
    el.focus();
    el.click();
    return true;
  }

  public filterItems(targetId: string, query: string): boolean {
    const el = this.registry.getElement(targetId);
    const lowerQuery = query.toLowerCase();

    // 1. If select element, select matching option
    if (el instanceof HTMLSelectElement) {
      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        if (opt.value.toLowerCase().includes(lowerQuery) || opt.text.toLowerCase().includes(lowerQuery)) {
          el.selectedIndex = i;
          this.dispatchChangeEvents(el);
          break;
        }
      }
    }

    // 2. Filter visible job cards in the document locally (C02)
    const jobCards = document.querySelectorAll('section, article');
    for (const card of Array.from(jobCards)) {
      if (card.hasAttribute('data-roha-ignore')) continue;
      const text = card.textContent?.toLowerCase() || '';

      if (!lowerQuery || lowerQuery === 'show all' || lowerQuery === 'all') {
        (card as HTMLElement).style.display = '';
      } else if (text.includes(lowerQuery)) {
        (card as HTMLElement).style.display = '';
      } else if (card.querySelector('button, a')) {
        // Only hide cards that look like vacancy items
        (card as HTMLElement).style.display = 'none';
      }
    }

    return true;
  }

  public submitForm(targetId: string): Promise<{ success: boolean; receipt?: string; error?: string }> {
    const el = this.registry.getElement(targetId);
    if (!el) {
      return Promise.resolve({ success: false, error: 'Target form not found' });
    }

    const form = el instanceof HTMLFormElement ? el : el.closest('form');
    if (!form) {
      return Promise.resolve({ success: false, error: 'No associated form' });
    }

    if (this.hostAdapter?.submitForm) {
      const formData = new FormData(form);
      const data: Record<string, any> = {};
      formData.forEach((val, key) => {
        data[key] = val;
      });
      return this.hostAdapter.submitForm(targetId, data);
    }

    // Dispatch native submit
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement;
    if (submitBtn) {
      submitBtn.click();
      return Promise.resolve({ success: true });
    }

    form.requestSubmit();
    return Promise.resolve({ success: true });
  }

  private dispatchChangeEvents(el: HTMLElement): void {
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }
}
