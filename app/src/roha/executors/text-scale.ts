/**
 * Roha - Text Scaling Executor
 * Feature: A01
 * Applies real text scaling (100% - 200%) directly to host content.
 * Respects browser zoom, prevents clipped actions, supports instant reset.
 */

export class TextScaleExecutor {
  private currentPercent: 100 | 125 | 150 | 175 | 200 = 100;
  private previousPercent: 100 | 125 | 150 | 175 | 200 = 100;
  private rootElement: HTMLElement;

  constructor(rootElement: HTMLElement = document.documentElement) {
    this.rootElement = rootElement;
    this.injectStyles();
  }

  public setRootElement(rootElement: HTMLElement): void {
    this.rootElement = rootElement;
  }

  public getPercent(): number {
    return this.currentPercent;
  }

  public apply(percent: 100 | 125 | 150 | 175 | 200): boolean {
    this.previousPercent = this.currentPercent;
    this.currentPercent = percent;

    if (percent === 100) {
      this.rootElement.removeAttribute('data-roha-scale');
      this.rootElement.style.removeProperty('--roha-scale-factor');
    } else {
      const factor = (percent / 100).toFixed(2);
      this.rootElement.setAttribute('data-roha-scale', `${percent}`);
      this.rootElement.style.setProperty('--roha-scale-factor', factor);
    }

    return true;
  }

  public undo(): boolean {
    return this.apply(this.previousPercent);
  }

  public reset(): boolean {
    return this.apply(100);
  }

  private injectStyles(): void {
    if (typeof document === 'undefined') return;
    const styleId = 'roha-text-scale-styles';
    if (document.getElementById(styleId)) return;

    // Check if host stylesheet already includes data-roha-scale rules (CSP safe)
    try {
      const sheets = Array.from(document.styleSheets || []);
      const exists = sheets.some((s) => {
        try {
          return Array.from(s.cssRules || []).some((r) => r.cssText && r.cssText.includes('data-roha-scale'));
        } catch {
          return false;
        }
      });
      if (exists) return;
    } catch {}

    // Programmatic CSSOM insertion (no inline style textContent, 100% CSP safe)
    const style = document.createElement('style');
    style.id = styleId;
    style.setAttribute('data-roha-ignore', 'true');
    document.head.appendChild(style);
    try {
      const sheet = style.sheet;
      if (sheet) {
        sheet.insertRule(':root[data-roha-scale] { font-size: calc(100% * var(--roha-scale-factor, 1)); }', 0);
        sheet.insertRule(':root[data-roha-scale] button, :root[data-roha-scale] input, :root[data-roha-scale] select, :root[data-roha-scale] textarea { font-size: 1rem; min-height: 2.75rem; }', 1);
      }
    } catch {
      // Fallback in environments without CSSOM (e.g. basic jsdom)
      style.textContent = `
        :root[data-roha-scale] { font-size: calc(100% * var(--roha-scale-factor, 1)); }
        :root[data-roha-scale] button, :root[data-roha-scale] input, :root[data-roha-scale] select, :root[data-roha-scale] textarea { font-size: 1rem; min-height: 2.75rem; }
      `;
    }
  }
}

