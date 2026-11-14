import { rc, RohaCopyKey } from './copy';
import { DiscoveredPageMap, Locale } from './types';
import { TargetRegistry } from './registry';
import { FormActionExecutor } from './executors/form-action';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Pending = { message: string; valid: () => boolean; apply: () => void | Promise<void> };
const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/[.!?።፧]+$/u, '');

/** User answers stay local. Approval is an interaction, never a model payload flag. */
export class FormGuide {
  private active: Field | null = null;
  private activeQuestion = '';
  private pending: Pending | null = null;
  private generation = 0;
  private guiding = false;

  constructor(
    private registry: TargetRegistry,
    private actions: FormActionExecutor,
    private root: () => HTMLElement | null,
    private map: () => DiscoveredPageMap | null,
    private locale: () => Locale,
    private say: (message: string) => void,
    private preview: (message: string | null) => void,
  ) {}

  private text(key: RohaCopyKey, values = {}): string { return rc(key, this.locale(), values); }
  private question(): string { return this.root()?.querySelector('h1')?.textContent || ''; }
  private name(el: Element): string {
    return this.map()?.resources.find(r => this.registry.getElement(r.id) === el)?.name || this.text('roha.inputField');
  }
  private fields(): Field[] {
    return (this.map()?.resources || []).filter(r => r.kind === 'field' && r.visible && r.enabled && r.allowedIntents.includes('propose_answer'))
      .map(r => this.registry.getElement(r.id)).filter((el): el is Field =>
        (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) &&
        this.usable(el) && !(el instanceof HTMLInputElement && ['password', 'hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(el.type)));
  }
  private usable(el: Element): boolean {
    return el.isConnected && !!this.root()?.contains(el) && !el.matches(':disabled, [readonly]') &&
      !el.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  private value(el: Field): string {
    return el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? String(el.checked) : el.value;
  }
  private snapshot(): string {
    const root = this.root();
    const copy = root?.cloneNode(true) as HTMLElement | undefined;
    copy?.querySelectorAll('[data-roha-ignore], [data-roha-assistant]').forEach(el => el.remove());
    return JSON.stringify([this.question(), copy?.textContent, Array.from(root?.querySelectorAll<Field>('input, select, textarea') || [])
      .filter(el => !el.closest('[data-roha-ignore], [data-roha-assistant]'))
      .map(el => [el.name, el.type, this.value(el), el.disabled])]);
  }

  public clear(): void { this.pending = null; this.generation++; this.preview(null); }
  public reset(): void { this.clear(); this.active = null; this.guiding = false; }
  public cancel(): void { this.clear(); this.say(this.text('roha.cancelled')); }
  public refresh(): void {
    if (this.pending && !this.pending.valid()) { this.clear(); this.say(this.text('roha.staleAction')); }
    if (this.active && (!this.usable(this.active) || this.question() !== this.activeQuestion)) this.active = null;
    if (this.guiding && this.question() !== this.activeQuestion) this.start();
  }

  private stage(pending: Pending): void {
    this.clear(); this.pending = pending; this.preview(pending.message); this.say(pending.message);
  }
  public async confirm(): Promise<void> {
    const pending = this.pending;
    this.clear();
    if (!pending) { this.say(this.text('roha.nothingPending')); return; }
    if (!pending.valid()) { this.say(this.text('roha.staleAction')); return; }
    try { await pending.apply(); } catch { this.say(this.text('roha.actionUnavailable')); }
  }

  public start(): void {
    this.clear();
    this.guiding = true;
    const fields = this.fields();
    this.active = fields.find(el => el === document.activeElement) || fields.find(el => !el.value) || fields[0] || null;
    this.activeQuestion = this.question();
    if (!this.active) { this.say(this.text('roha.noFields')); return; }
    this.prompt();
  }

  private prompt(): void {
    if (!this.active) return;
    const field = this.active;
    let choices: string[] = [];
    if (field instanceof HTMLSelectElement) choices = Array.from(field.options).filter(o => o.value && !o.disabled).map(o => o.text);
    if (field instanceof HTMLInputElement && ['radio', 'checkbox'].includes(field.type)) {
      choices = this.fields().filter(el => el instanceof HTMLInputElement && el.type === field.type && el.name === field.name).map(el => this.name(el));
    }
    const choiceText = choices.length ? this.text('roha.chooseOne', { choices: choices.map((c, i) => `${i + 1}. ${c}`).join('; ') }) : '';
    this.say(this.text('roha.askField', { name: this.name(field), choices: choiceText }));
  }

  public answer(value: string): boolean {
    if (!this.active) return false;
    if (!this.usable(this.active) || this.question() !== this.activeQuestion) {
      this.reset(); this.say(this.text('roha.staleAction')); return true;
    }
    let field = this.active;
    value = value.replace(/^(?:answer\s*:?\s+|my name is\s+|ስሜ\s+)/iu, '').trim();
    const lower = normalized(value).replace(/^(?:choose|select|option)\s+/u, '');
    if (field instanceof HTMLInputElement && ['radio', 'checkbox'].includes(field.type)) {
      const choices = this.fields().filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === field.type && el.name === field.name);
      const matches = choices.filter((el, i) => normalized(this.name(el)) === lower || normalized(el.value) === lower || String(i + 1) === lower);
      if (matches.length === 1) { field = matches[0]; value = field.type === 'checkbox' ? 'true' : field.value; }
      else if (field.type === 'checkbox' && ['yes', 'true', 'አዎ', 'no', 'false', 'አይ'].includes(lower)) value = ['yes', 'true', 'አዎ'].includes(lower) ? 'true' : 'false';
      else { this.say(this.text('roha.choiceMismatch')); return true; }
    }
    if (field instanceof HTMLSelectElement) {
      const options = Array.from(field.options).filter(o => o.value && !o.disabled);
      const matches = options.filter((o, i) => normalized(o.text) === lower || normalized(o.value) === lower || String(i + 1) === lower);
      if (matches.length !== 1) { this.say(this.text('roha.choiceMismatch')); return true; }
      value = matches[0].value;
    }
    const target = this.map()?.resources.find(r => this.registry.getElement(r.id) === field);
    if (target) this.propose(target.id, value);
    return true;
  }

  public propose(targetId: string, value: string): boolean {
    const field = this.fields().find(el => this.registry.getElement(targetId) === el);
    if (!field || value.length > 4000) { this.say(this.text('roha.actionUnavailable')); return false; }
    const before = this.value(field), question = this.question(), name = this.name(field);
    const snapshot = this.snapshot();
    let display = value;
    if (field instanceof HTMLSelectElement) {
      const options = Array.from(field.options).filter(o => !o.disabled && o.value !== '' && (normalized(o.value) === normalized(value) || normalized(o.text) === normalized(value)));
      if (options.length !== 1) { this.say(this.text('roha.choiceMismatch')); return false; }
      display = options[0].text; value = options[0].value;
    }
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      if (!['true', 'yes', 'false', 'no'].includes(value.toLowerCase())) { this.say(this.text('roha.choiceMismatch')); return false; }
      display = this.text(['true', 'yes'].includes(value.toLowerCase()) ? 'roha.checked' : 'roha.unchecked');
    }
    if (field instanceof HTMLInputElement && field.type === 'radio') {
      if (field.value !== value) { this.say(this.text('roha.choiceMismatch')); return false; }
      display = name;
    }
    this.active = field; this.activeQuestion = question;
    this.stage({
      message: this.text('roha.proposed', { name, value: display }),
      valid: () => this.usable(field) && this.registry.getElement(targetId) === field && this.value(field) === before &&
        this.fields().includes(field) &&
        this.question() === question && this.name(field) === name && this.snapshot() === snapshot,
      apply: () => {
        if (!this.actions.proposeAnswer(targetId, value)) { this.say(this.text('roha.actionUnavailable')); return; }
        this.say(this.text('roha.answerUpdated', { name, value: display }));
      },
    });
    return true;
  }

  public forward(): void {
    if (this.pending) { this.say(this.pending.message); return; }
    this.clear();
    const root = this.root();
    const button = root?.querySelector<HTMLButtonElement>('form button[type="submit"], form input[type="submit"]');
    if (!button || !this.usable(button)) { this.say(this.text('roha.actionUnavailable')); return; }
    // Only the known OpenPath wizard distinguishes continuing from final submission.
    if (root?.id === 'op-main' && root.dataset.stepType && !['submit', 'done'].includes(root.dataset.stepType)) {
      this.active = null; button.click(); this.say(this.text('roha.stepChanged')); return;
    }
    const target = this.map()?.resources.find(r => r.kind === 'form' && this.registry.getElement(r.id) === button.form);
    if (target) this.submit(target.id); else this.say(this.text('roha.actionUnavailable'));
  }
  public back(): void {
    this.reset();
    const button = this.root()?.querySelector<HTMLButtonElement>('.op-btn-back');
    if (!button || !this.usable(button)) { this.say(this.text('roha.actionUnavailable')); return; }
    button.click(); this.say(this.text('roha.stepChanged'));
  }
  public submit(targetId: string): boolean {
    const form = this.registry.getElement(targetId);
    const permitted = () => Boolean(this.map()?.resources.some(r => r.id === targetId && r.allowedIntents.includes('request_submission')));
    if (!(form instanceof HTMLFormElement) || !this.usable(form) || !permitted()) { this.say(this.text('roha.actionUnavailable')); return false; }
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"], input[type="submit"]');
    const snapshot = this.snapshot();
    this.stage({
      message: this.text('roha.submitApproval', { name: button?.textContent?.trim() || button?.value || this.text('roha.send') }),
      valid: () => permitted() && this.usable(form) && this.registry.getElement(targetId) === form && this.snapshot() === snapshot && (!button || this.usable(button)),
      apply: async () => {
        const generation = this.generation;
        const result = await this.actions.submitForm(targetId);
        if (this.generation === generation) this.say(this.text(result.success ? 'roha.submitRequested' : 'roha.actionUnavailable'));
      },
    });
    return true;
  }
  public review(): void {
    this.clear();
    if (this.root()?.dataset.stepType === 'review') { this.say(this.root()!.innerText); return; }
    const answers = this.fields().map(el => {
      let value = el.value;
      if (el instanceof HTMLSelectElement) value = el.selectedOptions[0]?.text || '';
      if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) value = this.text(el.checked ? 'roha.checked' : 'roha.unchecked');
      return `${this.name(el)}: ${value || this.text('roha.emptyAnswer')}`;
    });
    this.say(this.text('roha.currentAnswers', { answers: answers.join('; ') || this.text('roha.emptyAnswer') }));
  }

  public command(utterance: string): boolean {
    const command = normalized(utterance);
    if (['confirm', 'yes confirm', 'አረጋግጥ'].includes(command) ||
      (['yes', 'አዎ'].includes(command) && (this.pending || !this.active))) { void this.confirm(); return true; }
    if (['cancel', 'change it', 'ሰርዝ', 'ቀይር'].includes(command) || (this.pending && ['no', 'አይ'].includes(command))) { this.cancel(); return true; }
    if (['help fill this form', 'fill this form', 'fill out my info', 'fill my info', 'help', "i'm stuck", 'ቅጹን ሙላ', 'እርዳኝ'].includes(command)) { this.start(); return true; }
    if (['next', 'next step', 'continue', 'ቀጣይ', 'ቀጥል'].includes(command)) { this.forward(); return true; }
    if (['back', 'go back', 'previous step', 'ተመለስ', 'ወደ ኋላ'].includes(command)) { this.back(); return true; }
    if (['review', 'check answers', 'check my answers', 'read my answers', 'ገምግም', 'መልሶቼን አንብብ'].includes(command)) { this.review(); return true; }
    if (this.active && ['repeat', 'repeat the question', 'ድገም'].includes(command)) { this.prompt(); return true; }
    return false;
  }
}
