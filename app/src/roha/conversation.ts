/**
 * Roha - Conversation State & Guided Form Engine
 * Features: V04, V06, V08, O01, O02, O03, O04
 * Tracks questions, proposed answers, answer corrections, and reviews.
 * Strictly guarantees no invented personal information (V06) and no inactivity timer (O03).
 */

import { DiscoveredResource, Locale } from './types';
import { rc } from './copy';

export interface FormQuestion {
  fieldId: string;
  name: string;
  fieldType: string;
  required: boolean;
  options?: { id: string; label: string }[];
  currentValue: string;
  proposedValue?: string;
  confirmed: boolean;
}

export interface ConversationTurn {
  questionIndex: number;
  fieldId: string;
  previousValue: string;
  newValue: string;
  timestamp: number;
}

export class ConversationManager {
  private questions: FormQuestion[] = [];
  private locale: Locale = 'en';

  public setLocale(locale: Locale): void { this.locale = locale; }
  private currentIndex: number = 0;
  private history: ConversationTurn[] = [];
  private preferredName: string = '';
  private lowLiteracyMode: boolean = false;

  constructor(lowLiteracy: boolean = false) {
    this.lowLiteracyMode = lowLiteracy;
  }

  public setLowLiteracyMode(enabled: boolean): void {
    this.lowLiteracyMode = enabled;
  }

  public isLowLiteracyMode(): boolean {
    return this.lowLiteracyMode;
  }

  public loadFields(resources: DiscoveredResource[]): void {
    this.questions = resources
      .filter((r) => r.kind === 'field' || r.kind === 'search')
      .map((r) => ({
        fieldId: r.id,
        name: r.name,
        fieldType: r.fieldType || 'text',
        required: r.required || false,
        options: r.options,
        currentValue: '',
        confirmed: false,
      }));
    this.currentIndex = 0;
  }

  public getCurrentQuestion(): FormQuestion | null {
    if (this.questions.length === 0 || this.currentIndex >= this.questions.length) {
      return null;
    }
    return this.questions[this.currentIndex];
  }

  public refreshFieldLabels(resources: DiscoveredResource[]): void {
    const fields = new Map(resources.map(resource => [resource.id, resource]));
    for (const question of this.questions) {
      const field = fields.get(question.fieldId);
      if (field) {
        question.name = field.name;
        question.options = field.options;
      }
    }
  }

  public getQuestionIndex(): number {
    return this.currentIndex;
  }

  public getTotalQuestions(): number {
    return this.questions.length;
  }

  public getAllAnswers(): Record<string, string> {
    const answers: Record<string, string> = {};
    for (const q of this.questions) {
      if (q.currentValue) {
        answers[q.fieldId] = q.currentValue;
      }
    }
    return answers;
  }

  public proposeAnswer(value: string): { question: FormQuestion; promptText: string } | null {
    const q = this.getCurrentQuestion();
    if (!q) return null;

    q.proposedValue = value;
    const promptText = rc('roha.proposedAnswer', this.locale, { value });
    return { question: q, promptText };
  }

  public acceptProposedAnswer(): { isComplete: boolean; nextQuestion: FormQuestion | null } {
    const q = this.getCurrentQuestion();
    if (q && q.proposedValue !== undefined) {
      const prev = q.currentValue;
      q.currentValue = q.proposedValue;
      q.confirmed = true;
      delete q.proposedValue;

      this.history.push({
        questionIndex: this.currentIndex,
        fieldId: q.fieldId,
        previousValue: prev,
        newValue: q.currentValue,
        timestamp: Date.now(),
      });

      // Special case: capture preferred name for personalization without fabricating (V06)
      if (q.fieldId.includes('name') && !this.preferredName) {
        this.preferredName = q.currentValue;
      }
    }

    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      return { isComplete: false, nextQuestion: this.getCurrentQuestion() };
    }

    return { isComplete: true, nextQuestion: null };
  }

  public correctSpecificField(fieldIdentifier: string, newValue?: string): FormQuestion | null {
    const lowerId = fieldIdentifier.toLowerCase();
    const index = this.questions.findIndex(
      (q) =>
        q.fieldId.toLowerCase().includes(lowerId) ||
        q.name.toLowerCase().includes(lowerId)
    );

    if (index === -1) return null;

    this.currentIndex = index;
    const q = this.questions[index];

    if (newValue !== undefined) {
      const prev = q.currentValue;
      q.currentValue = newValue;
      q.confirmed = true;
      this.history.push({
        questionIndex: index,
        fieldId: q.fieldId,
        previousValue: prev,
        newValue,
        timestamp: Date.now(),
      });
    }

    return q;
  }

  public goBack(): FormQuestion | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.getCurrentQuestion();
    }
    return null;
  }

  public undoLastAnswer(): FormQuestion | null {
    const lastTurn = this.history.pop();
    if (!lastTurn) return null;

    const q = this.questions[lastTurn.questionIndex];
    if (q) {
      q.currentValue = lastTurn.previousValue;
      this.currentIndex = lastTurn.questionIndex;
      return q;
    }
    return null;
  }

  public getResumeRecap(): string {
    const q = this.getCurrentQuestion();
    if (!q) {
      return rc('roha.resumeComplete', this.locale);
    }
    const nameIntro = this.preferredName ? `${this.preferredName}, ` : '';
    return rc('roha.resumeStep', this.locale, { name: nameIntro, step: this.currentIndex + 1, total: this.questions.length, question: q.name });
  }

  /**
   * Orientation summary: "Where am I?" (Feature A06)
   */
  public getOrientationSummary(pageTitle: string = rc('roha.currentPage', this.locale)): string {
    const total = this.questions.length;
    const current = this.getCurrentQuestion();
    const answered = this.questions.filter((q) => q.confirmed).length;

    if (!current) {
      return rc('roha.orientationComplete', this.locale, { title: pageTitle, total });
    }

    return rc('roha.orientationProgress', this.locale, { title: pageTitle, step: this.currentIndex + 1, total, question: current.name, answered });
  }

  /**
   * Application checklist for a vacancy (Feature C04)
   */
  public getJobChecklist(): { requiredRemaining: string[]; optionalRemaining: string[]; isReadyToSubmit: boolean } {
    const requiredRemaining: string[] = [];
    const optionalRemaining: string[] = [];

    for (const q of this.questions) {
      if (!q.confirmed || !q.currentValue) {
        if (q.required) {
          requiredRemaining.push(q.name);
        } else {
          optionalRemaining.push(q.name);
        }
      }
    }

    return {
      requiredRemaining,
      optionalRemaining,
      isReadyToSubmit: requiredRemaining.length === 0,
    };
  }

  /**
   * Normalizes spoken digits or spelling for phone and ID verification (Feature V07)
   */
  public normalizeSpokenDigits(spoken: string): string {
    const wordToDigit: Record<string, string> = {
      zero: '0',
      one: '1',
      two: '2',
      three: '3',
      four: '4',
      five: '5',
      six: '6',
      seven: '7',
      eight: '8',
      nine: '9',
      ዜሮ: '0',
      አንድ: '1',
      ሁለት: '2',
      ሦስት: '3',
      አራት: '4',
      አምስት: '5',
      ስድስት: '6',
      ሰባት: '7',
      ስምንት: '8',
      ዘጠኝ: '9',
    };

    let result = spoken.toLowerCase();
    for (const [word, digit] of Object.entries(wordToDigit)) {
      result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
    }

    // Strip spaces between digits
    return result.replace(/(\d)\s+(\d)/g, '$1$2').replace(/(\d)\s+(\d)/g, '$1$2');
  }

  /**
   * "I'm Stuck" Signature Experience Handler
   * Maps 7 core learner difficulty situations to permitted, approved next steps.
   */
  public handleImStuck(
    situationText: string,
    locale: Locale = this.locale
  ): { barrier: string; explanation: string; suggestedAction: string } {
    const text = situationText.toLowerCase();
    const currentQ = this.getCurrentQuestion();
    const qName = currentQ?.name || rc('roha.currentQuestion', locale);

    // 1. Don't understand
    if (text.includes("don't understand") || text.includes('dont understand') || text.includes('አልገባኝም') || text.includes('ትርጉም')) {
      const explanation = rc('roha.barrierUnderstand', locale, { question: qName });
      return { barrier: 'dont_understand', explanation, suggestedAction: 'simple_mode' };
    }

    // 2. Can't read this
    if (text.includes("can't read") || text.includes('cant read') || text.includes('ማንበብ አልችልም') || text.includes('አይኔ')) {
      const explanation = rc('roha.barrierRead', locale, { question: qName });
      return { barrier: 'cant_read', explanation, suggestedAction: 'read' };
    }

    // 3. Don't have that document / ID
    if (text.includes('document') || text.includes('id') || text.includes('መታወቂያ') || text.includes('ሰነድ') || text.includes('የለኝም')) {
      const explanation = rc('roha.barrierDocument', locale, { question: qName });
      return { barrier: 'no_document', explanation, suggestedAction: 'explain_referral' };
    }

    // 4. Can't type
    if (text.includes("can't type") || text.includes('cant type') || text.includes('መተየብ አልችልም') || text.includes('መጻፍ')) {
      const explanation = rc('roha.barrierType', locale, { question: qName });
      return { barrier: 'cant_type', explanation, suggestedAction: 'enable_voice' };
    }

    // 5. Someone is helping me
    if (text.includes('helping') || text.includes('ሰው እያገዘኝ') || text.includes('ረዳት') || text.includes('አጋዥ')) {
      const explanation = rc('roha.barrierHelper', locale, { question: qName });
      return { barrier: 'someone_helping', explanation, suggestedAction: 'partner_assisted' };
    }

    // 6. My connection stopped / offline
    if (text.includes('connection') || text.includes('internet') || text.includes('offline') || text.includes('ኔትወርክ') || text.includes('ኢንተርኔት')) {
      const explanation = rc('roha.barrierOffline', locale, { question: qName });
      return { barrier: 'connection_stopped', explanation, suggestedAction: 'offline_reassure' };
    }

    // 7. Don't want to answer / privacy
    if (text.includes("don't want to answer") || text.includes('dont want') || text.includes('መመለስ አልፈልግም') || text.includes('ሚስጥር')) {
      const explanation = rc('roha.barrierPrivacy', locale, { question: qName });
      return { barrier: 'dont_want_to_answer', explanation, suggestedAction: 'prefer_not_to_say' };
    }

    // Default friendly barrier handler
    const explanation = rc('roha.barrierGeneral', locale, { question: qName });
    return { barrier: 'general_stuck', explanation, suggestedAction: 'explain' };
  }

  /**
   * Partial Name Correction: "Keep my first name; change my last name"
   * Preserves Ethiopian patronymic structures while allowing precise single-component edits.
   */
  public updatePartialName(
    fieldId: string,
    partToKeep: 'first' | 'last',
    newPart: string
  ): FormQuestion | null {
    const q = this.questions.find((item) => item.fieldId.toLowerCase().includes(fieldId.toLowerCase()));
    if (!q) return null;

    const current = (q.currentValue || '').trim();
    const parts = current ? current.split(/\s+/) : [];
    let updatedValue = '';

    if (partToKeep === 'first') {
      const firstName = parts[0] || '';
      updatedValue = `${firstName} ${newPart}`.trim();
    } else {
      const restOfName = parts.slice(1).join(' ') || '';
      updatedValue = `${newPart} ${restOfName}`.trim();
    }

    const prev = q.currentValue;
    q.currentValue = updatedValue;
    q.confirmed = true;
    this.history.push({
      questionIndex: this.questions.indexOf(q),
      fieldId: q.fieldId,
      previousValue: prev,
      newValue: updatedValue,
      timestamp: Date.now(),
    });

    return q;
  }

  /**
   * "Check My Answer": Formatted read-back of all recorded answers
   */
  public getFormattedReviewSummary(locale: Locale = this.locale): string {
    const answered = this.questions.filter((q) => q.confirmed && q.currentValue);
    if (answered.length === 0) {
      return rc('roha.reviewEmpty', locale);
    }

    const intro = rc('roha.reviewIntro', locale);

    const items = answered.map((q, idx) => {
      return rc('roha.reviewItem', locale, { number: idx + 1, name: q.name, value: q.currentValue });
    });

    const footer = rc('roha.reviewFooter', locale);

    return `${intro} ${items.join(', ')}. ${footer}`;
  }
}
