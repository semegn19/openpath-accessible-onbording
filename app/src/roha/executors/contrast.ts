/**
 * Roha - Contrast & Motion Executor
 * Feature: A04
 * Reversible high-contrast, reduced motion, and calm view.
 */

export class ContrastExecutor {
  private currentTheme: 'default' | 'high-contrast' = 'default';
  private reducedMotionEnabled: boolean = false;
  private rootElement: HTMLElement;

  constructor(rootElement: HTMLElement = document.documentElement) {
    this.rootElement = rootElement;
    this.injectStyles();
  }

  public getTheme(): 'default' | 'high-contrast' {
    return this.currentTheme;
  }

  public isReducedMotion(): boolean {
    return this.reducedMotionEnabled;
  }

  public applyContrast(theme: 'default' | 'high-contrast'): boolean {
    this.currentTheme = theme;
    if (theme === 'high-contrast') {
      this.rootElement.setAttribute('data-roha-contrast', 'high-contrast');
    } else {
      this.rootElement.removeAttribute('data-roha-contrast');
    }
    return true;
  }

  public applyReducedMotion(enabled: boolean): boolean {
    this.reducedMotionEnabled = enabled;
    if (enabled) {
      this.rootElement.setAttribute('data-roha-reduced-motion', 'true');
    } else {
      this.rootElement.removeAttribute('data-roha-reduced-motion');
    }
    return true;
  }

  public reset(): void {
    this.applyContrast('default');
    this.applyReducedMotion(false);
  }

  private injectStyles(): void {
    if (typeof document === 'undefined') return;
    const styleId = 'roha-contrast-styles';
    if (document.getElementById(styleId)) return;

    // Check if host stylesheet already includes data-roha-contrast rules (CSP safe)
    try {
      const sheets = Array.from(document.styleSheets || []);
      const exists = sheets.some((s) => {
        try {
          return Array.from(s.cssRules || []).some((r) => r.cssText && r.cssText.includes('data-roha-contrast'));
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
        sheet.insertRule(':root[data-roha-contrast="high-contrast"] { background-color: #000000 !important; color: #ffffff !important; }', 0);
        sheet.insertRule(':root[data-roha-contrast="high-contrast"] body, :root[data-roha-contrast="high-contrast"] main, :root[data-roha-contrast="high-contrast"] section, :root[data-roha-contrast="high-contrast"] article, :root[data-roha-contrast="high-contrast"] form { background-color: #000000 !important; color: #ffffff !important; }', 1);
        sheet.insertRule(':root[data-roha-contrast="high-contrast"] a { color: #ffff00 !important; text-decoration: underline !important; }', 2);
        sheet.insertRule(':root[data-roha-contrast="high-contrast"] button, :root[data-roha-contrast="high-contrast"] input, :root[data-roha-contrast="high-contrast"] select, :root[data-roha-contrast="high-contrast"] textarea { background-color: #1a1a1a !important; color: #ffffff !important; border: 2px solid #ffffff !important; }', 3);
        sheet.insertRule(':root[data-roha-contrast="high-contrast"] button:focus, :root[data-roha-contrast="high-contrast"] input:focus, :root[data-roha-contrast="high-contrast"] select:focus, :root[data-roha-contrast="high-contrast"] textarea:focus { outline: 3px solid #ffff00 !important; outline-offset: 2px !important; }', 4);
        sheet.insertRule(':root[data-roha-reduced-motion="true"] * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }', 5);
      }
    } catch {
      // Fallback in environments without CSSOM
      style.textContent = `
        :root[data-roha-contrast="high-contrast"] { background-color: #000000 !important; color: #ffffff !important; }
        :root[data-roha-reduced-motion="true"] * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
      `;
    }
  }
}

